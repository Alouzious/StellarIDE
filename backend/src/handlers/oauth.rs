use axum::{
    extract::{Query, State},
    response::Redirect,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    errors::{AppError, Result},
    handlers::auth::create_token,
    models::user::User,
    AppState,
};

// ── Shared query params for OAuth callbacks ───────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct OAuthCallback {
    pub code: Option<String>,
    pub error: Option<String>,
}

// ── GitHub ────────────────────────────────────────────────────────────────────

pub async fn github_login(State(state): State<AppState>) -> Result<Redirect> {
    let client_id = state
        .config
        .github_client_id
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("GitHub OAuth is not configured".into()))?;

    let redirect_uri = format!("{}/api/v1/auth/github/callback", backend_base(&state));
    let url = format!(
        "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&scope=user:email",
        client_id,
        urlencoding::encode(&redirect_uri)
    );
    Ok(Redirect::temporary(&url))
}

pub async fn github_callback(
    State(state): State<AppState>,
    Query(params): Query<OAuthCallback>,
) -> Result<Redirect> {
    if let Some(err) = &params.error {
        let url = format!("{}/login?error={}", state.config.frontend_url, urlencoding::encode(err));
        return Ok(Redirect::temporary(&url));
    }

    let code = params
        .code
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("Missing OAuth code".into()))?;

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

    // Exchange code for access token
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
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("No access_token in GitHub response")))?;

    // Get user email from GitHub API
    let emails_resp = http
        .get("https://api.github.com/user/emails")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "StellarIDE")
        .send()
        .await
        .map_err(|e| AppError::Internal(e.into()))?
        .json::<Vec<serde_json::Value>>()
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    let email = emails_resp
        .iter()
        .find(|e| e["primary"].as_bool().unwrap_or(false))
        .and_then(|e| e["email"].as_str())
        .or_else(|| emails_resp.first().and_then(|e| e["email"].as_str()))
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("No email returned from GitHub")))?
        .to_string();

    let jwt = find_or_create_user(&state, &email, "github").await?;
    let url = format!("{}/auth/callback?token={}", state.config.frontend_url, jwt);
    Ok(Redirect::temporary(&url))
}

// ── Google ────────────────────────────────────────────────────────────────────

pub async fn google_login(State(state): State<AppState>) -> Result<Redirect> {
    let client_id = state
        .config
        .google_client_id
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("Google OAuth is not configured".into()))?;

    let redirect_uri = format!("{}/api/v1/auth/google/callback", backend_base(&state));
    let url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=openid%20email%20profile&access_type=offline",
        client_id,
        urlencoding::encode(&redirect_uri)
    );
    Ok(Redirect::temporary(&url))
}

pub async fn google_callback(
    State(state): State<AppState>,
    Query(params): Query<OAuthCallback>,
) -> Result<Redirect> {
    if let Some(err) = &params.error {
        let url = format!("{}/login?error={}", state.config.frontend_url, urlencoding::encode(err));
        return Ok(Redirect::temporary(&url));
    }

    let code = params
        .code
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("Missing OAuth code".into()))?;

    let client_id = state
        .config
        .google_client_id
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("Google OAuth is not configured".into()))?;

    let client_secret = state
        .config
        .google_client_secret
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("Google OAuth is not configured".into()))?;

    let redirect_uri = format!("{}/api/v1/auth/google/callback", backend_base(&state));

    let http = reqwest::Client::new();
    let token_resp = http
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", code),
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("redirect_uri", redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(e.into()))?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    let access_token = token_resp["access_token"]
        .as_str()
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("No access_token in Google response")))?;

    let userinfo = http
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await
        .map_err(|e| AppError::Internal(e.into()))?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    let email = userinfo["email"]
        .as_str()
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("No email returned from Google")))?
        .to_string();

    let jwt = find_or_create_user(&state, &email, "google").await?;
    let url = format!("{}/auth/callback?token={}", state.config.frontend_url, jwt);
    Ok(Redirect::temporary(&url))
}

// ── OAuth status endpoint ─────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct OAuthProvidersResponse {
    pub github: bool,
    pub google: bool,
}

pub async fn oauth_providers(State(state): State<AppState>) -> Json<OAuthProvidersResponse> {
    Json(OAuthProvidersResponse {
        github: state.config.github_client_id.is_some(),
        google: state.config.google_client_id.is_some(),
    })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn backend_base(state: &AppState) -> String {
    // Build the backend base URL from the port config
    format!("http://localhost:{}", state.config.port)
}

async fn find_or_create_user(state: &AppState, email: &str, _provider: &str) -> Result<String> {
    // Try to find existing user
    let existing = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(email)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    let user = if let Some(u) = existing {
        u
    } else {
        // Create user with a non-password-based sentinel that bcrypt will never match.
        // The "OAUTH_NO_PASSWORD:" prefix combined with a UUID ensures this value cannot
        // be reproduced by any password-based login attempt.
        let placeholder_hash = format!("OAUTH_NO_PASSWORD:{}", Uuid::new_v4());
        sqlx::query_as::<_, User>(
            r#"INSERT INTO users (id, email, password_hash, created_at, updated_at)
               VALUES ($1, $2, $3, NOW(), NOW())
               RETURNING *"#,
        )
        .bind(Uuid::new_v4())
        .bind(email)
        .bind(&placeholder_hash)
        .fetch_one(&state.db)
        .await
        .map_err(|e| AppError::Internal(e.into()))?
    };

    let token = create_token(
        user.id,
        &user.email,
        &state.config.jwt_secret,
        state.config.jwt_expiry_hours,
    )
    .map_err(|e| AppError::Internal(e))?;

    Ok(token)
}
