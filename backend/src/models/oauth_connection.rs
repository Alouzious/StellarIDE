use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow)]
pub struct OAuthConnection {
    pub id: Uuid,
    pub user_id: Uuid,
    pub provider: String,
    pub access_token: String,
    pub scopes: Option<String>,
    pub provider_login: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct GitHubStatusResponse {
    pub connected: bool,
    pub github_login: Option<String>,
    pub scopes: Option<String>,
    /// Human-readable explanation when `connected` is false because a previously
    /// stored token turned out to be expired or revoked.
    pub reason: Option<String>,
}
