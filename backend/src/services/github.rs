use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::errors::{AppError, Result};

const GITHUB_API: &str = "https://api.github.com";

pub struct GitHubClient {
    http: Client,
    token: String,
}

impl GitHubClient {
    pub fn new(token: impl Into<String>) -> Self {
        Self {
            http: Client::new(),
            token: token.into(),
        }
    }

    fn authed(&self, req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        req.header("Authorization", format!("Bearer {}", self.token))
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "StellarIDE")
            .header("X-GitHub-Api-Version", "2022-11-28")
    }

    async fn parse_error(resp: reqwest::Response) -> AppError {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        AppError::BadRequest(format!("GitHub API error ({status}): {body}"))
    }

    pub async fn get_repo(&self, owner: &str, repo: &str) -> Result<GitHubRepo> {
        let resp = self
            .authed(self.http.get(format!("{GITHUB_API}/repos/{owner}/{repo}")))
            .send()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        if !resp.status().is_success() {
            return Err(Self::parse_error(resp).await);
        }

        resp.json()
            .await
            .map_err(|e| AppError::Internal(e.into()))
    }

    pub async fn list_repos(&self, page: u32, per_page: u32) -> Result<Vec<GitHubRepoListItem>> {
        let resp = self
            .authed(self.http.get(format!(
                "{GITHUB_API}/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page={per_page}&page={page}"
            )))
            .send()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        if !resp.status().is_success() {
            return Err(Self::parse_error(resp).await);
        }

        resp.json()
            .await
            .map_err(|e| AppError::Internal(e.into()))
    }

    /// Resolve a branch (empty = default) to its current head commit SHA.
    pub async fn get_branch_head_sha(&self, owner: &str, repo: &str, branch: &str) -> Result<String> {
        let ref_branch = if branch.is_empty() {
            self.get_repo(owner, repo).await?.default_branch
        } else {
            branch.to_string()
        };

        let ref_resp: GitHubRef = self
            .authed(self.http.get(format!(
                "{GITHUB_API}/repos/{owner}/{repo}/git/ref/heads/{ref_branch}"
            )))
            .send()
            .await
            .map_err(|e| AppError::Internal(e.into()))?
            .error_for_status()
            .map_err(|e| AppError::BadRequest(format!("GitHub ref error: {e}")))?
            .json()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        Ok(ref_resp.object.sha)
    }

    pub async fn get_file_tree(&self, owner: &str, repo: &str, branch: &str) -> Result<GitHubTree> {
        let repo_info = self.get_repo(owner, repo).await?;
        let ref_branch = if branch.is_empty() {
            repo_info.default_branch.as_str()
        } else {
            branch
        };

        let ref_resp: GitHubRef = self
            .authed(self.http.get(format!(
                "{GITHUB_API}/repos/{owner}/{repo}/git/ref/heads/{ref_branch}"
            )))
            .send()
            .await
            .map_err(|e| AppError::Internal(e.into()))?
            .error_for_status()
            .map_err(|e| AppError::BadRequest(format!("GitHub ref error: {e}")))?
            .json()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        let commit_sha = ref_resp.object.sha;
        let commit: GitHubCommit = self
            .authed(self.http.get(format!(
                "{GITHUB_API}/repos/{owner}/{repo}/git/commits/{commit_sha}"
            )))
            .send()
            .await
            .map_err(|e| AppError::Internal(e.into()))?
            .error_for_status()
            .map_err(|e| AppError::BadRequest(format!("GitHub commit error: {e}")))?
            .json()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        let tree: GitHubTree = self
            .authed(self.http.get(format!(
                "{GITHUB_API}/repos/{owner}/{repo}/git/trees/{}?recursive=1",
                commit.tree.sha
            )))
            .send()
            .await
            .map_err(|e| AppError::Internal(e.into()))?
            .error_for_status()
            .map_err(|e| AppError::BadRequest(format!("GitHub tree error: {e}")))?
            .json()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        Ok(tree)
    }

    pub async fn get_file_content(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
        branch: &str,
    ) -> Result<GitHubFileContent> {
        let mut url = format!("{GITHUB_API}/repos/{owner}/{repo}/contents/{path}");
        if !branch.is_empty() {
            url.push_str(&format!("?ref={branch}"));
        }

        let resp = self
            .authed(self.http.get(&url))
            .send()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        if !resp.status().is_success() {
            return Err(Self::parse_error(resp).await);
        }

        let raw: GitHubContentResponse = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        if raw.content.is_none() {
            return Err(AppError::BadRequest(format!(
                "Path '{path}' is not a file (may be a directory)"
            )));
        }

        let encoding = raw.encoding.as_deref().unwrap_or("base64");
        let content = if encoding == "base64" {
            let cleaned = raw.content.unwrap_or_default().replace('\n', "");
            String::from_utf8(BASE64.decode(cleaned).map_err(|e| AppError::Internal(e.into()))?)
                .map_err(|e| AppError::Internal(e.into()))?
        } else {
            raw.content.unwrap_or_default()
        };

        Ok(GitHubFileContent {
            path: raw.path,
            content,
            sha: raw.sha,
            size: raw.size.unwrap_or(0),
        })
    }

    pub async fn get_blob_text(&self, owner: &str, repo: &str, blob_sha: &str) -> Result<String> {
        let blob: GitHubBlob = self
            .authed(self.http.get(format!(
                "{GITHUB_API}/repos/{owner}/{repo}/git/blobs/{blob_sha}"
            )))
            .send()
            .await
            .map_err(|e| AppError::Internal(e.into()))?
            .error_for_status()
            .map_err(|e| AppError::BadRequest(format!("GitHub blob error: {e}")))?
            .json()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        if blob.encoding != "base64" {
            return Err(AppError::BadRequest("Unsupported blob encoding".into()));
        }

        let bytes = BASE64
            .decode(blob.content.replace('\n', ""))
            .map_err(|e| AppError::Internal(e.into()))?;

        String::from_utf8(bytes).map_err(|e| AppError::BadRequest(format!("Binary file: {e}")))
    }

    /// Push a single file via Contents API (creates one commit per file).
    pub async fn push_file(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
        branch: &str,
        message: &str,
        content: &str,
        existing_sha: Option<&str>,
    ) -> Result<GitHubPushResult> {
        let body = serde_json::json!({
            "message": message,
            "content": BASE64.encode(content.as_bytes()),
            "branch": branch,
            "sha": existing_sha,
        });

        let resp = self
            .authed(self.http.put(format!(
                "{GITHUB_API}/repos/{owner}/{repo}/contents/{path}"
            )))
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        if !resp.status().is_success() {
            return Err(Self::parse_error(resp).await);
        }

        let result: GitHubContentUpdateResponse = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        Ok(GitHubPushResult {
            commit_sha: result.commit.sha,
            file_sha: result.content.sha,
        })
    }

    /// Push multiple files in a single atomic commit via Git Data API.
    pub async fn push_files(
        &self,
        owner: &str,
        repo: &str,
        branch: &str,
        message: &str,
        files: &[PushFileEntry],
        deletions: &[String],
        expected_head: Option<&str>,
    ) -> Result<GitHubPushResult> {
        let ref_resp: GitHubRef = self
            .authed(self.http.get(format!(
                "{GITHUB_API}/repos/{owner}/{repo}/git/ref/heads/{branch}"
            )))
            .send()
            .await
            .map_err(|e| AppError::Internal(e.into()))?
            .error_for_status()
            .map_err(|e| AppError::BadRequest(format!("GitHub ref error: {e}")))?
            .json()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        let base_commit_sha = ref_resp.object.sha;

        // Conflict guard: if we know the commit this project was last synced to and
        // the remote branch has advanced past it, refuse to push so we don't silently
        // clobber commits made on GitHub since the last import/push.
        if let Some(expected) = expected_head {
            if !expected.is_empty() && expected != base_commit_sha {
                return Err(AppError::Conflict(
                    "This repo has new commits on GitHub since you last synced. Refresh from GitHub before pushing so your changes don't overwrite them.".into(),
                ));
            }
        }
        let base_commit: GitHubCommit = self
            .authed(self.http.get(format!(
                "{GITHUB_API}/repos/{owner}/{repo}/git/commits/{base_commit_sha}"
            )))
            .send()
            .await
            .map_err(|e| AppError::Internal(e.into()))?
            .error_for_status()
            .map_err(|e| AppError::BadRequest(format!("GitHub commit error: {e}")))?
            .json()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        let mut tree_items: Vec<serde_json::Value> = Vec::new();
        let mut last_file_sha = String::new();

        for file in files {
            let blob_body = serde_json::json!({
                "content": file.content,
                "encoding": "utf-8",
            });

            let blob: GitHubBlobCreateResponse = self
                .authed(self.http.post(format!(
                    "{GITHUB_API}/repos/{owner}/{repo}/git/blobs"
                )))
                .json(&blob_body)
                .send()
                .await
                .map_err(|e| AppError::Internal(e.into()))?
                .error_for_status()
                .map_err(|e| AppError::BadRequest(format!("GitHub blob create error: {e}")))?
                .json()
                .await
                .map_err(|e| AppError::Internal(e.into()))?;

            last_file_sha = blob.sha.clone();
            tree_items.push(serde_json::json!({
                "path": file.path,
                "mode": "100644",
                "type": "blob",
                "sha": blob.sha,
            }));
        }

        // Deleting a path from a tree built on `base_tree` is done by sending a null
        // sha for that path. This propagates files the user removed locally.
        for path in deletions {
            tree_items.push(serde_json::json!({
                "path": path,
                "mode": "100644",
                "type": "blob",
                "sha": serde_json::Value::Null,
            }));
        }

        let tree_body = serde_json::json!({
            "base_tree": base_commit.tree.sha,
            "tree": tree_items,
        });

        let new_tree: GitHubTreeCreateResponse = self
            .authed(self.http.post(format!(
                "{GITHUB_API}/repos/{owner}/{repo}/git/trees"
            )))
            .json(&tree_body)
            .send()
            .await
            .map_err(|e| AppError::Internal(e.into()))?
            .error_for_status()
            .map_err(|e| AppError::BadRequest(format!("GitHub tree create error: {e}")))?
            .json()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        let commit_body = serde_json::json!({
            "message": message,
            "tree": new_tree.sha,
            "parents": [base_commit_sha],
        });

        let new_commit: GitHubCommitCreateResponse = self
            .authed(self.http.post(format!(
                "{GITHUB_API}/repos/{owner}/{repo}/git/commits"
            )))
            .json(&commit_body)
            .send()
            .await
            .map_err(|e| AppError::Internal(e.into()))?
            .error_for_status()
            .map_err(|e| AppError::BadRequest(format!("GitHub commit create error: {e}")))?
            .json()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        self.authed(self.http.patch(format!(
            "{GITHUB_API}/repos/{owner}/{repo}/git/refs/heads/{branch}"
        )))
        .json(&serde_json::json!({ "sha": new_commit.sha }))
        .send()
        .await
        .map_err(|e| AppError::Internal(e.into()))?
        .error_for_status()
        .map_err(|e| AppError::BadRequest(format!("GitHub ref update error: {e}")))?;

        Ok(GitHubPushResult {
            commit_sha: new_commit.sha,
            file_sha: last_file_sha,
        })
    }

    /// Whether a branch exists on the remote.
    pub async fn branch_exists(&self, owner: &str, repo: &str, branch: &str) -> Result<bool> {
        let resp = self
            .authed(self.http.get(format!(
                "{GITHUB_API}/repos/{owner}/{repo}/git/ref/heads/{branch}"
            )))
            .send()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        if resp.status().is_success() {
            Ok(true)
        } else if resp.status().as_u16() == 404 {
            Ok(false)
        } else {
            Err(Self::parse_error(resp).await)
        }
    }

    /// Create a new branch pointing at `from_sha`.
    pub async fn create_branch(
        &self,
        owner: &str,
        repo: &str,
        new_branch: &str,
        from_sha: &str,
    ) -> Result<()> {
        let resp = self
            .authed(self.http.post(format!("{GITHUB_API}/repos/{owner}/{repo}/git/refs")))
            .json(&serde_json::json!({
                "ref": format!("refs/heads/{new_branch}"),
                "sha": from_sha,
            }))
            .send()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        if !resp.status().is_success() {
            return Err(Self::parse_error(resp).await);
        }
        Ok(())
    }

    /// Open a pull request and return its html URL.
    pub async fn create_pull_request(
        &self,
        owner: &str,
        repo: &str,
        head: &str,
        base: &str,
        title: &str,
        body: &str,
    ) -> Result<String> {
        let resp = self
            .authed(self.http.post(format!("{GITHUB_API}/repos/{owner}/{repo}/pulls")))
            .json(&serde_json::json!({
                "title": title,
                "head": head,
                "base": base,
                "body": body,
            }))
            .send()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        if !resp.status().is_success() {
            return Err(Self::parse_error(resp).await);
        }

        let pr: GitHubPullRequest = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;
        Ok(pr.html_url)
    }
}

#[derive(Debug, Deserialize)]
struct GitHubPullRequest {
    html_url: String,
}

#[derive(Debug, Clone)]
pub struct PushFileEntry {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubRepo {
    pub default_branch: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubRepoListItem {
    pub id: i64,
    pub name: String,
    pub full_name: String,
    pub private: bool,
    pub default_branch: String,
    pub html_url: String,
    pub updated_at: String,
    pub owner: GitHubRepoOwner,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubRepoOwner {
    pub login: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubRef {
    pub object: GitHubRefObject,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubRefObject {
    pub sha: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubCommit {
    pub tree: GitHubTreeRef,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubTreeRef {
    pub sha: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubTree {
    pub sha: String,
    pub tree: Vec<GitHubTreeEntry>,
    pub truncated: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubTreeEntry {
    pub path: String,
    pub mode: String,
    #[serde(rename = "type")]
    pub entry_type: String,
    pub sha: String,
    pub size: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubContentResponse {
    pub path: String,
    pub sha: String,
    pub content: Option<String>,
    pub encoding: Option<String>,
    pub size: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct GitHubFileContent {
    pub path: String,
    pub content: String,
    pub sha: String,
    pub size: u64,
}

#[derive(Debug, Deserialize)]
struct GitHubBlob {
    content: String,
    encoding: String,
}

#[derive(Debug, Deserialize)]
struct GitHubContentUpdateResponse {
    commit: GitHubCommitCreateResponse,
    content: GitHubContentSha,
}

#[derive(Debug, Deserialize)]
struct GitHubContentSha {
    sha: String,
}

#[derive(Debug, Deserialize)]
struct GitHubBlobCreateResponse {
    sha: String,
}

#[derive(Debug, Deserialize)]
struct GitHubTreeCreateResponse {
    sha: String,
}

#[derive(Debug, Deserialize)]
struct GitHubCommitCreateResponse {
    sha: String,
}

#[derive(Debug, Serialize)]
pub struct GitHubPushResult {
    pub commit_sha: String,
    pub file_sha: String,
}

const SKIP_PREFIXES: &[&str] = &[
    ".git/",
    "target/",
    "node_modules/",
    ".cargo/",
];

const SKIP_EXTENSIONS: &[&str] = &[".wasm", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".zip", ".pdf"];

pub const MAX_IMPORT_FILE_BYTES: u64 = 512_000;

/// Why a repo path was (or wasn't) imported. Used to give the user a clear
/// per-file breakdown instead of silently dropping files.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImportDecision {
    Import,
    /// Build artifact / vcs metadata / directory entry — not interesting to report.
    SkipArtifact,
    SkipBinary,
    SkipTooLarge,
}

pub fn classify_import_path(path: &str, size: Option<u64>) -> ImportDecision {
    if path.ends_with('/') || SKIP_PREFIXES.iter().any(|p| path.starts_with(p)) {
        return ImportDecision::SkipArtifact;
    }
    if SKIP_EXTENSIONS.iter().any(|ext| path.ends_with(ext)) {
        return ImportDecision::SkipBinary;
    }
    if let Some(s) = size {
        if s > MAX_IMPORT_FILE_BYTES {
            return ImportDecision::SkipTooLarge;
        }
    }
    ImportDecision::Import
}

pub fn should_import_path(path: &str, size: Option<u64>) -> bool {
    matches!(classify_import_path(path, size), ImportDecision::Import)
}

pub fn language_for_path(path: &str) -> &'static str {
    if path.ends_with(".toml") {
        "toml"
    } else if path.ends_with(".rs") {
        "rust"
    } else if path.ends_with(".md") {
        "markdown"
    } else {
        "plaintext"
    }
}

/// Normalize a GitHub subfolder path (no leading/trailing slashes).
pub fn normalize_subfolder(subfolder: &str) -> Option<String> {
    let trimmed = subfolder.trim().trim_matches('/');
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

/// Whether a GitHub tree path lives under the given subfolder.
pub fn file_in_subfolder(path: &str, subfolder: &str) -> bool {
    match normalize_subfolder(subfolder) {
        None => true,
        Some(sub) => path == sub || path.starts_with(&format!("{sub}/")),
    }
}

/// Strip subfolder prefix for storage in project_files (contract-relative paths).
pub fn strip_subfolder_prefix(path: &str, subfolder: &str) -> Option<String> {
    let sub = normalize_subfolder(subfolder)?;
    if path == sub {
        return None;
    }
    let prefix = format!("{sub}/");
    if path.starts_with(&prefix) {
        Some(path[prefix.len()..].to_string())
    } else {
        None
    }
}

/// Build full GitHub repo path from a contract-relative project file path.
pub fn github_path_from_local(local_path: &str, subfolder: &Option<String>) -> String {
    match subfolder.as_ref().and_then(|s| normalize_subfolder(s)) {
        None => local_path.to_string(),
        Some(sub) => {
            if local_path.is_empty() {
                sub
            } else {
                format!("{sub}/{local_path}")
            }
        }
    }
}

const CONTRACT_FOLDER_HINTS: &[&str] = &[
    "contracts",
    "contract",
    "on-chain",
    "onchain",
    "soroban",
    "smart-contract",
    "smart_contract",
];

#[derive(Debug, Clone, Serialize)]
pub struct RepoFolderInfo {
    pub name: String,
    pub has_cargo_toml: bool,
    pub suggested: bool,
}

/// Analyze a recursive Git tree for top-level folders and contract hints.
pub fn analyze_repo_folders(tree: &GitHubTree) -> (bool, bool, Vec<RepoFolderInfo>) {
    let mut has_root_cargo = false;
    let mut folder_cargo: std::collections::HashMap<String, bool> =
        std::collections::HashMap::new();
    let mut top_level_files = false;

    for entry in &tree.tree {
        if entry.entry_type != "blob" {
            continue;
        }
        let path = &entry.path;
        if !path.contains('/') {
            if path == "Cargo.toml" {
                has_root_cargo = true;
            }
            top_level_files = true;
            continue;
        }
        let Some((folder, rest)) = path.split_once('/') else {
            continue;
        };
        if rest == "Cargo.toml" {
            folder_cargo.insert(folder.to_string(), true);
        } else {
            folder_cargo.entry(folder.to_string()).or_insert(false);
        }
    }

    let has_nested_folders = !folder_cargo.is_empty();
    let is_flat = !has_nested_folders && top_level_files && has_root_cargo;

    let mut folders: Vec<RepoFolderInfo> = folder_cargo
        .into_iter()
        .map(|(name, has_cargo_toml)| {
            let lower = name.to_lowercase();
            let suggested = has_cargo_toml
                || CONTRACT_FOLDER_HINTS
                    .iter()
                    .any(|hint| lower == *hint || lower.contains(hint));
            RepoFolderInfo {
                name,
                has_cargo_toml,
                suggested,
            }
        })
        .collect();

    folders.sort_by(|a, b| {
        b.suggested
            .cmp(&a.suggested)
            .then(b.has_cargo_toml.cmp(&a.has_cargo_toml))
            .then(a.name.cmp(&b.name))
    });

    (has_root_cargo, is_flat, folders)
}

/// Parse owner/repo from a GitHub URL or "owner/repo" shorthand.
pub fn parse_github_repo_url(input: &str) -> Option<(String, String)> {
    let trimmed = input.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return None;
    }
    if let Some(rest) = trimmed.strip_prefix("https://github.com/") {
        let parts: Vec<&str> = rest.split('/').filter(|p| !p.is_empty()).collect();
        if parts.len() >= 2 {
            return Some((parts[0].to_string(), parts[1].to_string()));
        }
        return None;
    }
    if let Some(rest) = trimmed.strip_prefix("http://github.com/") {
        let parts: Vec<&str> = rest.split('/').filter(|p| !p.is_empty()).collect();
        if parts.len() >= 2 {
            return Some((parts[0].to_string(), parts[1].to_string()));
        }
        return None;
    }
    let parts: Vec<&str> = trimmed.split('/').filter(|p| !p.is_empty()).collect();
    if parts.len() == 2 {
        Some((parts[0].to_string(), parts[1].to_string()))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skips_build_artifacts() {
        assert!(!should_import_path("target/debug/foo", Some(100)));
        assert!(!should_import_path(".git/config", Some(100)));
        assert!(!should_import_path("contract.wasm", Some(100)));
    }

    #[test]
    fn allows_source_files() {
        assert!(should_import_path("src/lib.rs", Some(1000)));
        assert!(should_import_path("Cargo.toml", Some(500)));
    }

    #[test]
    fn subfolder_path_helpers() {
        assert!(file_in_subfolder("contracts/src/lib.rs", "contracts"));
        assert!(!file_in_subfolder("frontend/src/App.tsx", "contracts"));
        assert_eq!(
            strip_subfolder_prefix("contracts/src/lib.rs", "contracts").unwrap(),
            "src/lib.rs"
        );
        assert_eq!(
            github_path_from_local("src/lib.rs", &Some("contracts".into())),
            "contracts/src/lib.rs"
        );
    }

    #[test]
    fn parses_github_urls() {
        assert_eq!(
            parse_github_repo_url("https://github.com/stellar/soroban-examples"),
            Some(("stellar".into(), "soroban-examples".into()))
        );
        assert_eq!(
            parse_github_repo_url("stellar/soroban-examples"),
            Some(("stellar".into(), "soroban-examples".into()))
        );
    }
}
