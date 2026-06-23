use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct GithubPush {
    pub id: Uuid,
    pub project_id: Uuid,
    pub user_id: Option<Uuid>,
    pub branch: String,
    pub message: String,
    pub commit_sha: Option<String>,
    pub file_count: i32,
    pub status: String,
    pub detail: Option<String>,
    pub created_at: DateTime<Utc>,
}
