use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use futures_util::stream::{self, StreamExt};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashSet;
use uuid::Uuid;

use crate::{
    errors::{AppError, Result},
    handlers::collab::resolve_collab_role,
    middleware::auth::AuthUser,
    models::{
        oauth_connection::OAuthConnection,
        project::Project,
        project_file::ProjectFile,
    },
    services::github::{
        analyze_repo_folders, classify_import_path, file_in_subfolder, github_path_from_local,
        language_for_path, normalize_subfolder, parse_github_repo_url, should_import_path,
        strip_subfolder_prefix, GitHubClient, ImportDecision, PushFileEntry,
    },
    AppState,
};

async fn github_client_for_user(state: &AppState, user_id: Uuid) -> Result<GitHubClient> {
    let conn = sqlx::query_as::<_, OAuthConnection>(
        "SELECT * FROM oauth_connections WHERE user_id = $1 AND provider = 'github'",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| {
        AppError::BadRequest(
            "GitHub is not connected. Sign in with GitHub or connect your account first.".into(),
        )
    })?;

    Ok(GitHubClient::new(conn.access_token))
}

#[derive(Debug, Deserialize)]
pub struct ListReposQuery {
    pub page: Option<u32>,
    pub per_page: Option<u32>,
}

pub async fn list_repos(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Query(q): Query<ListReposQuery>,
) -> Result<Json<Value>> {
    let client = github_client_for_user(&state, auth.id).await?;
    let repos = client
        .list_repos(q.page.unwrap_or(1), q.per_page.unwrap_or(30).min(100))
        .await?;
    Ok(Json(json!({ "repos": repos })))
}

#[derive(Debug, Deserialize)]
pub struct RepoBranchQuery {
    pub branch: Option<String>,
}

pub async fn get_file_tree(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path((owner, repo)): Path<(String, String)>,
    Query(q): Query<RepoBranchQuery>,
) -> Result<Json<Value>> {
    let client = github_client_for_user(&state, auth.id).await?;
    let branch = q.branch.unwrap_or_default();
    let tree = client.get_file_tree(&owner, &repo, &branch).await?;

    let entries: Vec<Value> = tree
        .tree
        .iter()
        .filter(|e| e.entry_type == "blob" && should_import_path(&e.path, e.size))
        .map(|e| {
            json!({
                "path": e.path,
                "sha": e.sha,
                "size": e.size,
            })
        })
        .collect();

    Ok(Json(json!({
        "tree_sha": tree.sha,
        "truncated": tree.truncated,
        "entries": entries,
    })))
}

#[derive(Debug, Deserialize)]
pub struct FileContentQuery {
    pub path: String,
    pub branch: Option<String>,
}

pub async fn get_file_content(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path((owner, repo)): Path<(String, String)>,
    Query(q): Query<FileContentQuery>,
) -> Result<Json<Value>> {
    if q.path.trim().is_empty() {
        return Err(AppError::BadRequest("path query parameter is required".into()));
    }

    let client = github_client_for_user(&state, auth.id).await?;
    let branch = q.branch.unwrap_or_default();
    let file = client
        .get_file_content(&owner, &repo, &q.path, &branch)
        .await?;

    Ok(Json(json!({
        "path": file.path,
        "content": file.content,
        "sha": file.sha,
        "size": file.size,
    })))
}

pub async fn list_repo_folders(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path((owner, repo)): Path<(String, String)>,
    Query(q): Query<RepoBranchQuery>,
) -> Result<Json<Value>> {
    let client = github_client_for_user(&state, auth.id).await?;
    let repo_info = client.get_repo(&owner, &repo).await?;
    let branch = q
        .branch
        .as_deref()
        .filter(|b| !b.is_empty())
        .unwrap_or(&repo_info.default_branch);
    let tree = client.get_file_tree(&owner, &repo, branch).await?;
    let (has_root_cargo, is_flat, folders) = analyze_repo_folders(&tree);

    Ok(Json(json!({
        "branch": branch,
        "has_root_cargo": has_root_cargo,
        "is_flat": is_flat,
        "folders": folders,
    })))
}

#[derive(Debug, Deserialize)]
pub struct ImportRepoRequest {
    pub owner: String,
    pub repo: String,
    pub branch: Option<String>,
    pub project_name: Option<String>,
    pub subfolder: Option<String>,
}

pub async fn import_repo(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Json(body): Json<ImportRepoRequest>,
) -> Result<Json<Value>> {
    let client = github_client_for_user(&state, auth.id).await?;
    let repo_info = client.get_repo(&body.owner, &body.repo).await?;
    let branch = body
        .branch
        .as_deref()
        .filter(|b| !b.is_empty())
        .unwrap_or(&repo_info.default_branch);

    let tree = client
        .get_file_tree(&body.owner, &body.repo, branch)
        .await?;

    let subfolder = body.subfolder.as_deref().and_then(normalize_subfolder);

    // Commit the import was taken from, so future pushes can detect remote drift.
    let head_sha = client
        .get_branch_head_sha(&body.owner, &body.repo, branch)
        .await
        .ok();

    // Classify every blob (applying the optional subfolder scope) into "fetch" vs.
    // "skip with a reason", so nothing is dropped without the user being told.
    let mut to_fetch: Vec<(String, String)> = Vec::new(); // (store_path, blob_sha)
    let mut skipped: Vec<Value> = Vec::new();
    for entry in &tree.tree {
        if entry.entry_type != "blob" {
            continue;
        }

        let store_path = if let Some(ref sub) = subfolder {
            if !file_in_subfolder(&entry.path, sub) {
                continue;
            }
            match strip_subfolder_prefix(&entry.path, sub) {
                Some(p) if !p.is_empty() => p,
                _ => continue,
            }
        } else {
            entry.path.clone()
        };

        match classify_import_path(&entry.path, entry.size) {
            ImportDecision::Import => to_fetch.push((store_path, entry.sha.clone())),
            ImportDecision::SkipArtifact => {}
            ImportDecision::SkipBinary => {
                skipped.push(json!({ "path": store_path, "reason": "binary" }))
            }
            ImportDecision::SkipTooLarge => {
                skipped.push(json!({ "path": store_path, "reason": "too_large" }))
            }
        }
    }

    // Fetch blob contents concurrently with bounded parallelism instead of one slow
    // serial request per file.
    const IMPORT_CONCURRENCY: usize = 10;
    let fetched: Vec<(String, String, Result<String>)> = stream::iter(to_fetch)
        .map(|(store_path, sha)| {
            let client = &client;
            let owner = body.owner.as_str();
            let repo = body.repo.as_str();
            async move {
                let content = client.get_blob_text(owner, repo, &sha).await;
                (store_path, sha, content)
            }
        })
        .buffer_unordered(IMPORT_CONCURRENCY)
        .collect()
        .await;

    let mut to_insert: Vec<(String, String, String)> = Vec::new(); // (store_path, content, sha)
    for (store_path, sha, content) in fetched {
        match content {
            Ok(c) => to_insert.push((store_path, c, sha)),
            Err(e) => {
                let reason = if e.to_string().contains("Binary file") {
                    "binary"
                } else {
                    "fetch_failed"
                };
                skipped.push(json!({ "path": store_path, "reason": reason }));
            }
        }
    }

    if to_insert.is_empty() {
        return Err(AppError::BadRequest(
            "No importable files found in the selected folder. Pick a folder that contains your Soroban contract (Cargo.toml + src/).".into(),
        ));
    }

    let project_name = body
        .project_name
        .as_deref()
        .filter(|n| !n.trim().is_empty())
        .unwrap_or(&body.repo);

    // Atomic: create the project and all its files together, or roll back entirely so
    // a mid-loop failure can't leave a half-imported orphan project.
    let mut tx = state.db.begin().await?;

    let project = sqlx::query_as::<_, Project>(
        r#"INSERT INTO projects (id, user_id, name, description, github_owner, github_repo, github_branch, github_subfolder, github_last_synced_sha, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
           RETURNING *"#,
    )
    .bind(Uuid::new_v4())
    .bind(auth.id)
    .bind(project_name)
    .bind(Some(format!("Imported from {}/{}", body.owner, body.repo)))
    .bind(&body.owner)
    .bind(&body.repo)
    .bind(branch)
    .bind(&subfolder)
    .bind(&head_sha)
    .fetch_one(&mut *tx)
    .await?;

    let imported = to_insert.len();
    for (store_path, content, sha) in &to_insert {
        sqlx::query(
            r#"INSERT INTO project_files (id, project_id, file_path, content, language, github_sha, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
               ON CONFLICT (project_id, file_path)
               DO UPDATE SET content = EXCLUDED.content, language = EXCLUDED.language,
                             github_sha = EXCLUDED.github_sha, updated_at = NOW()"#,
        )
        .bind(Uuid::new_v4())
        .bind(project.id)
        .bind(store_path)
        .bind(content)
        .bind(language_for_path(store_path))
        .bind(sha)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    let truncated_warning = if tree.truncated {
        Some(
            "This repository is very large, so GitHub returned only part of its file list. Some files may be missing — consider importing a specific contract subfolder.".to_string(),
        )
    } else {
        None
    };

    Ok(Json(json!({
        "project": project,
        "files_imported": imported,
        "files_skipped": skipped.len(),
        "skipped": skipped,
        "branch": branch,
        "subfolder": subfolder,
        "truncated": tree.truncated,
        "warning": truncated_warning,
    })))
}

#[derive(Debug, Deserialize)]
pub struct PushFileRequest {
    pub path: String,
    pub content: String,
    pub message: String,
    pub branch: Option<String>,
    pub sha: Option<String>,
}

pub async fn push_file(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path((owner, repo)): Path<(String, String)>,
    Json(body): Json<PushFileRequest>,
) -> Result<Json<Value>> {
    if body.path.trim().is_empty() || body.message.trim().is_empty() {
        return Err(AppError::BadRequest("path and message are required".into()));
    }

    let client = github_client_for_user(&state, auth.id).await?;
    let branch = body.branch.as_deref().unwrap_or("main");

    let result = client
        .push_file(
            &owner,
            &repo,
            &body.path,
            branch,
            &body.message,
            &body.content,
            body.sha.as_deref(),
        )
        .await?;

    Ok(Json(json!({
        "success": true,
        "commit_sha": result.commit_sha,
        "file_sha": result.file_sha,
    })))
}

#[derive(Debug, Deserialize)]
pub struct PushProjectRequest {
    pub message: String,
    pub branch: Option<String>,
    pub open_pr: Option<bool>,
    pub pr_base: Option<String>,
    pub pr_title: Option<String>,
}

async fn record_push(
    state: &AppState,
    project_id: Uuid,
    user_id: Uuid,
    branch: &str,
    message: &str,
    commit_sha: Option<&str>,
    file_count: i32,
    status: &str,
    detail: Option<&str>,
) {
    let _ = sqlx::query(
        r#"INSERT INTO github_pushes (id, project_id, user_id, branch, message, commit_sha, file_count, status, detail, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())"#,
    )
    .bind(Uuid::new_v4())
    .bind(project_id)
    .bind(user_id)
    .bind(branch)
    .bind(message)
    .bind(commit_sha)
    .bind(file_count)
    .bind(status)
    .bind(detail)
    .execute(&state.db)
    .await;
}

pub async fn push_project(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<PushProjectRequest>,
) -> Result<Json<Value>> {
    if body.message.trim().is_empty() {
        return Err(AppError::BadRequest("Commit message is required".into()));
    }

    let project =
        sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = $1")
            .bind(project_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or(AppError::NotFound)?;

    let role = resolve_collab_role(&state, project_id, auth.id).await?;
    if role != "owner" && role != "editor" {
        return Err(AppError::Forbidden);
    }

    let owner = project
        .github_owner
        .clone()
        .ok_or_else(|| AppError::BadRequest("Project is not linked to a GitHub repo".into()))?;
    let repo = project
        .github_repo
        .clone()
        .ok_or_else(|| AppError::BadRequest("Project is not linked to a GitHub repo".into()))?;
    let target_branch = body
        .branch
        .as_deref()
        .filter(|b| !b.trim().is_empty())
        .or(project.github_branch.as_deref())
        .unwrap_or("main")
        .to_string();

    // Only the branch the project is tracked against participates in conflict
    // detection and local-state updates; pushing to a different branch (e.g. for a
    // PR) is treated as an independent publish.
    let pushing_to_synced = project.github_branch.as_deref() == Some(target_branch.as_str());

    let client = github_client_for_user(&state, auth.id).await?;

    // Create the target branch from the repo's default branch if it doesn't exist yet.
    if !client.branch_exists(&owner, &repo, &target_branch).await? {
        let repo_info = client.get_repo(&owner, &repo).await?;
        let base_sha = client
            .get_branch_head_sha(&owner, &repo, &repo_info.default_branch)
            .await?;
        client
            .create_branch(&owner, &repo, &target_branch, &base_sha)
            .await?;
    }

    let files = sqlx::query_as::<_, ProjectFile>(
        "SELECT * FROM project_files WHERE project_id = $1 ORDER BY file_path",
    )
    .bind(project_id)
    .fetch_all(&state.db)
    .await?;

    let push_files: Vec<PushFileEntry> = files
        .iter()
        .filter(|f| {
            !f.file_path.ends_with(".wasm")
                && !f.file_path.starts_with("target/")
                && f.language != "wasm"
        })
        .map(|f| PushFileEntry {
            path: github_path_from_local(&f.file_path, &project.github_subfolder),
            content: f.content.clone(),
        })
        .collect();

    // Determine which managed files exist on the remote but no longer exist locally
    // so they are deleted in this push instead of lingering on GitHub forever. Only
    // files StellarIDE actually tracks (would import) are eligible — binaries, build
    // artifacts and images on the remote are left untouched.
    let local_paths: HashSet<String> = push_files.iter().map(|f| f.path.clone()).collect();
    let mut deletions: Vec<String> = Vec::new();
    if let Ok(remote_tree) = client.get_file_tree(&owner, &repo, &target_branch).await {
        for entry in &remote_tree.tree {
            if entry.entry_type != "blob" {
                continue;
            }
            if let Some(sub) = project.github_subfolder.as_deref() {
                if !file_in_subfolder(&entry.path, sub) {
                    continue;
                }
            }
            if !should_import_path(&entry.path, entry.size) {
                continue;
            }
            if !local_paths.contains(&entry.path) {
                deletions.push(entry.path.clone());
            }
        }
    }

    if push_files.is_empty() && deletions.is_empty() {
        return Err(AppError::BadRequest("No changes to push".into()));
    }

    let expected_head = if pushing_to_synced {
        project.github_last_synced_sha.as_deref()
    } else {
        None
    };

    let result = match client
        .push_files(
            &owner,
            &repo,
            &target_branch,
            &body.message,
            &push_files,
            &deletions,
            expected_head,
        )
        .await
    {
        Ok(r) => r,
        Err(e) => {
            let status = if matches!(e, AppError::Conflict(_)) {
                "conflict"
            } else {
                "error"
            };
            record_push(
                &state,
                project_id,
                auth.id,
                &target_branch,
                &body.message,
                None,
                0,
                status,
                Some(&e.to_string()),
            )
            .await;
            return Err(e);
        }
    };

    // Optionally open a pull request from the pushed branch into a base branch.
    let mut pr_url: Option<String> = None;
    let mut pr_error: Option<String> = None;
    if body.open_pr.unwrap_or(false) {
        let repo_info = client.get_repo(&owner, &repo).await?;
        let base = body
            .pr_base
            .as_deref()
            .filter(|b| !b.trim().is_empty())
            .unwrap_or(repo_info.default_branch.as_str());
        if base == target_branch.as_str() {
            pr_error = Some("Pull request base and branch are the same; pushed without opening a PR.".into());
        } else {
            let title = body
                .pr_title
                .as_deref()
                .filter(|t| !t.trim().is_empty())
                .unwrap_or(body.message.as_str());
            match client
                .create_pull_request(&owner, &repo, &target_branch, base, title, &body.message)
                .await
            {
                Ok(url) => pr_url = Some(url),
                Err(e) => pr_error = Some(e.to_string()),
            }
        }
    }

    // Record local sync state only when we pushed to the tracked branch.
    if pushing_to_synced {
        let _ = sqlx::query(
            "UPDATE projects SET github_last_synced_sha = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(&result.commit_sha)
        .bind(project_id)
        .execute(&state.db)
        .await;

        if let Ok(tree) = client.get_file_tree(&owner, &repo, &target_branch).await {
            for entry in &tree.tree {
                if entry.entry_type != "blob" {
                    continue;
                }
                for file in &files {
                    let github_path =
                        github_path_from_local(&file.file_path, &project.github_subfolder);
                    if entry.path == github_path {
                        let _ = sqlx::query(
                            "UPDATE project_files SET github_sha = $1, updated_at = NOW() WHERE project_id = $2 AND file_path = $3",
                        )
                        .bind(&entry.sha)
                        .bind(project_id)
                        .bind(&file.file_path)
                        .execute(&state.db)
                        .await;
                        break;
                    }
                }
            }
        }
    }

    record_push(
        &state,
        project_id,
        auth.id,
        &target_branch,
        &body.message,
        Some(&result.commit_sha),
        push_files.len() as i32,
        "success",
        pr_url.as_deref(),
    )
    .await;

    Ok(Json(json!({
        "success": true,
        "commit_sha": result.commit_sha,
        "files_pushed": push_files.len(),
        "files_deleted": deletions.len(),
        "branch": target_branch,
        "pr_url": pr_url,
        "pr_error": pr_error,
    })))
}

#[derive(Debug, Deserialize)]
pub struct DiffQuery {
    pub branch: Option<String>,
}

/// Compute the set of changes between the project's local files and the remote
/// branch, plus whether the remote has advanced past our last sync (conflict).
pub async fn diff_project(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Query(q): Query<DiffQuery>,
) -> Result<Json<Value>> {
    let project = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = $1")
        .bind(project_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let role = resolve_collab_role(&state, project_id, auth.id).await?;
    if role != "owner" && role != "editor" {
        return Err(AppError::Forbidden);
    }

    let owner = project
        .github_owner
        .clone()
        .ok_or_else(|| AppError::BadRequest("Project is not linked to a GitHub repo".into()))?;
    let repo = project
        .github_repo
        .clone()
        .ok_or_else(|| AppError::BadRequest("Project is not linked to a GitHub repo".into()))?;
    let branch = q
        .branch
        .as_deref()
        .filter(|b| !b.trim().is_empty())
        .or(project.github_branch.as_deref())
        .unwrap_or("main")
        .to_string();

    let client = github_client_for_user(&state, auth.id).await?;

    let pushing_to_synced = project.github_branch.as_deref() == Some(branch.as_str());
    let remote_head = client.get_branch_head_sha(&owner, &repo, &branch).await.ok();
    let conflict = pushing_to_synced
        && matches!(
            (project.github_last_synced_sha.as_deref(), remote_head.as_deref()),
            (Some(synced), Some(head)) if synced != head
        );

    let files = sqlx::query_as::<_, ProjectFile>(
        "SELECT * FROM project_files WHERE project_id = $1 ORDER BY file_path",
    )
    .bind(project_id)
    .fetch_all(&state.db)
    .await?;

    let local: Vec<(String, String)> = files
        .iter()
        .filter(|f| {
            !f.file_path.ends_with(".wasm")
                && !f.file_path.starts_with("target/")
                && f.language != "wasm"
        })
        .map(|f| {
            (
                github_path_from_local(&f.file_path, &project.github_subfolder),
                f.content.clone(),
            )
        })
        .collect();
    let local_paths: HashSet<String> = local.iter().map(|(p, _)| p.clone()).collect();

    // Remote managed files (path -> blob sha) within scope.
    let mut remote: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    if let Ok(tree) = client.get_file_tree(&owner, &repo, &branch).await {
        for entry in &tree.tree {
            if entry.entry_type != "blob" {
                continue;
            }
            if let Some(sub) = project.github_subfolder.as_deref() {
                if !file_in_subfolder(&entry.path, sub) {
                    continue;
                }
            }
            if should_import_path(&entry.path, entry.size) {
                remote.insert(entry.path.clone(), entry.sha.clone());
            }
        }
    }

    let mut added: Vec<String> = Vec::new();
    let mut in_both: Vec<(String, String, String)> = Vec::new(); // (path, remote_sha, local_content)
    for (path, content) in &local {
        match remote.get(path) {
            Some(sha) => in_both.push((path.clone(), sha.clone(), content.clone())),
            None => added.push(path.clone()),
        }
    }

    // Compare content for files present on both sides by fetching the remote blob.
    const DIFF_CONCURRENCY: usize = 10;
    let compared: Vec<(String, bool)> = stream::iter(in_both)
        .map(|(path, sha, content)| {
            let client = &client;
            let owner = owner.as_str();
            let repo = repo.as_str();
            async move {
                let remote_content = client.get_blob_text(owner, repo, &sha).await.ok();
                let changed = match remote_content {
                    Some(rc) => rc != content,
                    None => true,
                };
                (path, changed)
            }
        })
        .buffer_unordered(DIFF_CONCURRENCY)
        .collect()
        .await;

    let mut modified: Vec<String> = Vec::new();
    for (path, changed) in compared {
        if changed {
            modified.push(path);
        }
    }

    let deleted: Vec<String> = remote
        .keys()
        .filter(|p| !local_paths.contains(*p))
        .cloned()
        .collect();

    added.sort();
    modified.sort();
    let mut deleted = deleted;
    deleted.sort();

    Ok(Json(json!({
        "branch": branch,
        "conflict": conflict,
        "remote_head": remote_head,
        "last_synced": project.github_last_synced_sha,
        "added": added,
        "modified": modified,
        "deleted": deleted,
        "has_changes": !added.is_empty() || !modified.is_empty() || !deleted.is_empty(),
    })))
}

pub async fn list_pushes(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Value>> {
    // Ensure the caller can see this project.
    let _ = resolve_collab_role(&state, project_id, auth.id).await?;

    let pushes = sqlx::query_as::<_, crate::models::github_push::GithubPush>(
        "SELECT * FROM github_pushes WHERE project_id = $1 ORDER BY created_at DESC LIMIT 30",
    )
    .bind(project_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(json!({ "pushes": pushes })))
}

#[derive(Debug, Deserialize)]
pub struct LinkRepoRequest {
    pub repo_url: String,
    pub branch: Option<String>,
    pub subfolder: Option<String>,
}

pub async fn link_project_repo(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<LinkRepoRequest>,
) -> Result<Json<Value>> {
    let (owner, repo) = parse_github_repo_url(&body.repo_url).ok_or_else(|| {
        AppError::BadRequest(
            "Invalid GitHub repo URL. Use https://github.com/owner/repo or owner/repo.".into(),
        )
    })?;

    let project =
        sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = $1")
            .bind(project_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or(AppError::NotFound)?;

    let role = resolve_collab_role(&state, project_id, auth.id).await?;
    if role != "owner" {
        return Err(AppError::Forbidden);
    }

    let client = github_client_for_user(&state, auth.id).await?;
    let repo_info = client.get_repo(&owner, &repo).await?;
    let branch = body
        .branch
        .as_deref()
        .filter(|b| !b.is_empty())
        .unwrap_or(&repo_info.default_branch);
    let subfolder = body.subfolder.as_deref().and_then(normalize_subfolder);
    let head_sha = client
        .get_branch_head_sha(&owner, &repo, branch)
        .await
        .ok();

    let updated = sqlx::query_as::<_, Project>(
        r#"UPDATE projects
           SET github_owner = $1, github_repo = $2, github_branch = $3, github_subfolder = $4, github_last_synced_sha = $5, updated_at = NOW()
           WHERE id = $6
           RETURNING *"#,
    )
    .bind(&owner)
    .bind(&repo)
    .bind(branch)
    .bind(&subfolder)
    .bind(&head_sha)
    .bind(project_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(json!({
        "project": updated,
        "linked": true,
    })))
}
