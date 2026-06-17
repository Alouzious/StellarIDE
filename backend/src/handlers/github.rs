use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
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
        language_for_path, should_import_path, GitHubClient, PushFileEntry,
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

#[derive(Debug, Deserialize)]
pub struct ImportRepoRequest {
    pub owner: String,
    pub repo: String,
    pub branch: Option<String>,
    pub project_name: Option<String>,
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

    let project_name = body
        .project_name
        .as_deref()
        .filter(|n| !n.trim().is_empty())
        .unwrap_or(&body.repo);

    let project = sqlx::query_as::<_, Project>(
        r#"INSERT INTO projects (id, user_id, name, description, github_owner, github_repo, github_branch, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
           RETURNING *"#,
    )
    .bind(Uuid::new_v4())
    .bind(auth.id)
    .bind(project_name)
    .bind(Some(format!("Imported from {}/{}", body.owner, body.repo)))
    .bind(&body.owner)
    .bind(&body.repo)
    .bind(branch)
    .fetch_one(&state.db)
    .await?;

    let mut imported = 0usize;
    for entry in &tree.tree {
        if entry.entry_type != "blob" || !should_import_path(&entry.path, entry.size) {
            continue;
        }

        let content = match client
            .get_blob_text(&body.owner, &body.repo, &entry.sha)
            .await
        {
            Ok(c) => c,
            Err(_) => continue,
        };

        sqlx::query(
            r#"INSERT INTO project_files (id, project_id, file_path, content, language, github_sha, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
               ON CONFLICT (project_id, file_path)
               DO UPDATE SET content = EXCLUDED.content, language = EXCLUDED.language,
                             github_sha = EXCLUDED.github_sha, updated_at = NOW()"#,
        )
        .bind(Uuid::new_v4())
        .bind(project.id)
        .bind(&entry.path)
        .bind(&content)
        .bind(language_for_path(&entry.path))
        .bind(&entry.sha)
        .execute(&state.db)
        .await?;

        imported += 1;
    }

    Ok(Json(json!({
        "project": project,
        "files_imported": imported,
        "branch": branch,
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
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("Project is not linked to a GitHub repo".into()))?;
    let repo = project
        .github_repo
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("Project is not linked to a GitHub repo".into()))?;
    let branch = body
        .branch
        .as_deref()
        .or(project.github_branch.as_deref())
        .unwrap_or("main");

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
            path: f.file_path.clone(),
            content: f.content.clone(),
        })
        .collect();

    if push_files.is_empty() {
        return Err(AppError::BadRequest("No text files to push".into()));
    }

    let client = github_client_for_user(&state, auth.id).await?;
    let result = client
        .push_files(owner, repo, branch, &body.message, &push_files)
        .await?;

    // Refresh blob SHAs from GitHub after push
    if let Ok(tree) = client.get_file_tree(owner, repo, branch).await {
        for entry in &tree.tree {
            if entry.entry_type != "blob" {
                continue;
            }
            let _ = sqlx::query(
                "UPDATE project_files SET github_sha = $1, updated_at = NOW() WHERE project_id = $2 AND file_path = $3",
            )
            .bind(&entry.sha)
            .bind(project_id)
            .bind(&entry.path)
            .execute(&state.db)
            .await;
        }
    }

    Ok(Json(json!({
        "success": true,
        "commit_sha": result.commit_sha,
        "files_pushed": push_files.len(),
    })))
}
