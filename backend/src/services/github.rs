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

pub fn should_import_path(path: &str, size: Option<u64>) -> bool {
    if SKIP_PREFIXES.iter().any(|p| path.starts_with(p)) {
        return false;
    }
    if path.ends_with('/') {
        return false;
    }
    if SKIP_EXTENSIONS
        .iter()
        .any(|ext| path.ends_with(ext))
    {
        return false;
    }
    if let Some(s) = size {
        if s > 512_000 {
            return false;
        }
    }
    true
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
}
