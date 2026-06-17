use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    errors::{AppError, Result},
    models::user::User,
    AppState,
};

const GITHUB_SCOPES: &str = "user:email repo";

#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthStateClaims {
    pub intent: String,
    pub sub: Option<Uuid>,
    pub exp: i64,
}

pub async fn upsert_github_connection(
    state: &AppState,
    user_id: Uuid,
    access_token: &str,
    scopes: Option<&str>,
) -> Result<()> {
    let http = reqwest::Client::new();
    let user: serde_json::Value = http
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "StellarIDE")
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
        .map_err(|e| AppError::Internal(e.into()))?
        .json()
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    let login = user["login"].as_str().map(String::from);

    sqlx::query(
        r#"INSERT INTO oauth_connections (id, user_id, provider, access_token, scopes, provider_login, created_at, updated_at)
           VALUES ($1, $2, 'github', $3, $4, $5, NOW(), NOW())
           ON CONFLICT (user_id, provider)
           DO UPDATE SET access_token = EXCLUDED.access_token,
                         scopes = EXCLUDED.scopes,
                         provider_login = EXCLUDED.provider_login,
                         updated_at = NOW()"#,
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(access_token)
    .bind(scopes)
    .bind(login)
    .execute(&state.db)
    .await
    .map_err(|e| AppError::Internal(e.into()))?;

    Ok(())
}

pub fn github_authorize_url(state: &AppState, oauth_state: &str) -> Result<String> {
    let client_id = state
        .config
        .github_client_id
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("GitHub OAuth is not configured".into()))?;

    let redirect_uri = format!("{}/api/v1/auth/github/callback", backend_base());
    Ok(format!(
        "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&scope={}&state={}",
        client_id,
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(GITHUB_SCOPES),
        urlencoding::encode(oauth_state),
    ))
}

pub fn encode_oauth_state(secret: &str, intent: &str, user_id: Option<Uuid>) -> Result<String> {
    let claims = OAuthStateClaims {
        intent: intent.to_string(),
        sub: user_id,
        exp: (Utc::now() + Duration::minutes(10)).timestamp(),
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(e.into()))
}

pub fn decode_oauth_state(secret: &str, token: &str) -> Result<OAuthStateClaims> {
    let data = decode::<OAuthStateClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| AppError::BadRequest("Invalid OAuth state".into()))?;
    Ok(data.claims)
}

pub async fn exchange_github_code(state: &AppState, code: &str) -> Result<(String, Option<String>)> {
    let client_id = state
        .config
        .github_client_id
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("GitHub OAuth is not configured".into()))?;

    let client_secret = state
        .config
        .github_client_secret
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("GitHub OAuth is not configured".into()))?;

    let http = reqwest::Client::new();
    let token_resp = http
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .json(&serde_json::json!({
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code
        }))
        .send()
        .await
        .map_err(|e| AppError::Internal(e.into()))?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    let access_token = token_resp["access_token"]
        .as_str()
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("No access_token in GitHub response")))?
        .to_string();

    let scopes = token_resp["scope"].as_str().map(String::from);
    Ok((access_token, scopes))
}

pub async fn github_primary_email(_state: &AppState, access_token: &str) -> Result<String> {
    let http = reqwest::Client::new();
    let emails_resp = http
        .get("https://api.github.com/user/emails")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "StellarIDE")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| AppError::Internal(e.into()))?
        .json::<Vec<serde_json::Value>>()
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    emails_resp
        .iter()
        .find(|e| e["primary"].as_bool().unwrap_or(false))
        .and_then(|e| e["email"].as_str())
        .or_else(|| emails_resp.first().and_then(|e| e["email"].as_str()))
        .map(String::from)
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("No email returned from GitHub")))
}

pub async fn find_or_create_user_by_email(state: &AppState, email: &str) -> Result<User> {
    let existing = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(email)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    if let Some(u) = existing {
        return Ok(u);
    }

    let placeholder_hash = format!("OAUTH_NO_PASSWORD:{}", Uuid::new_v4());
    let user = sqlx::query_as::<_, User>(
        r#"INSERT INTO users (id, email, password_hash, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           RETURNING *"#,
    )
    .bind(Uuid::new_v4())
    .bind(email)
    .bind(&placeholder_hash)
    .fetch_one(&state.db)
    .await
    .map_err(|e| AppError::Internal(e.into()))?;

    Ok(user)
}

pub fn backend_base() -> String {
    std::env::var("BACKEND_URL")
        .unwrap_or_else(|_| "http://localhost:8080".to_string())
        .trim_end_matches('/')
        .to_string()
}
