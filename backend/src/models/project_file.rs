use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProjectFile {
    pub id: Uuid,
    pub project_id: Uuid,
    pub file_path: String,
    pub content: String,
    pub language: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SaveFileRequest {
    pub file_path: String,
    pub content: String,
    pub language: Option<String>,
}
