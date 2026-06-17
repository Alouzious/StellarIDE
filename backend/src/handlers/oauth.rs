use axum::{
    extract::{Query, State},
    response::Redirect,
    Extension, Json,
};
use serde::{Deserialize, Serialize};

use crate::{
    errors::{AppError, Result},
    handlers::auth::create_token,
    middleware::auth::AuthUser,
    models::oauth_connection::GitHubStatusResponse,
    services::oauth_github::{
        backend_base, decode_oauth_state, encode_oauth_state, exchange_github_code,
        find_or_create_user_by_email, github_authorize_url, github_primary_email,
        upsert_github_connection,
    },
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct OAuthCallback {
    pub code: Option<String>,
    pub error: Option<String>,
    pub state: Option<String>,
}

pub async fn github_login(State(state): State<AppState>) -> Result<Redirect> {
    let oauth_state = encode_oauth_state(&state.config.jwt_secret, "login", None)?;
    let url = github_authorize_url(&state, &oauth_state)?;
    Ok(Redirect::temporary(&url))
}

pub async fn github_connect(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>> {
    let oauth_state = encode_oauth_state(&state.config.jwt_secret, "connect", Some(auth.id))?;
    let url = github_authorize_url(&state, &oauth_state)?;
    Ok(Json(serde_json::json!({ "url": url })))
}

pub async fn github_callback(
    State(state): State<AppState>,
    Query(params): Query<OAuthCallback>,
) -> Result<Redirect> {
    if let Some(err) = &params.error {
        let url = format!(
            "{}/login?error={}",
            state.config.frontend_url,
            urlencoding::encode(err)
        );
        return Ok(Redirect::temporary(&url));
    }

    let code = params
        .code
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("Missing OAuth code".into()))?;

    let (access_token, scopes) = exchange_github_code(&state, code).await?;
    let scopes_str = scopes.as_deref();

    let intent = params
        .state
        .as_deref()
        .map(|s| decode_oauth_state(&state.config.jwt_secret, s))
        .transpose()?
        .map(|c| c.intent)
        .unwrap_or_else(|| "login".to_string());

    if intent == "connect" {
        let claims = decode_oauth_state(
            &state.config.jwt_secret,
            params.state.as_deref().unwrap_or(""),
        )?;
        let user_id = claims
            .sub
            .ok_or_else(|| AppError::BadRequest("Missing user in OAuth state".into()))?;

        upsert_github_connection(&state, user_id, &access_token, scopes_str).await?;

        let url = format!(
            "{}/dashboard?github=connected",
            state.config.frontend_url
        );
        return Ok(Redirect::temporary(&url));
    }

    let email = github_primary_email(&state, &access_token).await?;
    let user = find_or_create_user_by_email(&state, &email).await?;
    upsert_github_connection(&state, user.id, &access_token, scopes_str).await?;

    let jwt = create_token(
        user.id,
        &user.email,
        &state.config.jwt_secret,
        state.config.jwt_expiry_hours,
    )
    .map_err(|e| AppError::Internal(e))?;

    let url = format!("{}/auth/callback?token={}", state.config.frontend_url, jwt);
    Ok(Redirect::temporary(&url))
}

pub async fn github_status(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
) -> Result<Json<GitHubStatusResponse>> {
    let conn = sqlx::query_as::<_, crate::models::oauth_connection::OAuthConnection>(
        "SELECT * FROM oauth_connections WHERE user_id = $1 AND provider = 'github'",
    )
    .bind(auth.id)
    .fetch_optional(&state.db)
    .await?;

    Ok(Json(match conn {
        Some(c) => GitHubStatusResponse {
            connected: true,
            github_login: c.provider_login,
            scopes: c.scopes,
        },
        None => GitHubStatusResponse {
            connected: false,
            github_login: None,
            scopes: None,
        },
    }))
}

// ── Google (unchanged flow) ───────────────────────────────────────────────────

pub async fn google_login(State(state): State<AppState>) -> Result<Redirect> {
    let client_id = state
        .config
        .google_client_id
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("Google OAuth is not configured".into()))?;

    let redirect_uri = format!("{}/api/v1/auth/google/callback", backend_base());
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
        let url = format!(
            "{}/login?error={}",
            state.config.frontend_url,
            urlencoding::encode(err)
        );
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

    let redirect_uri = format!("{}/api/v1/auth/google/callback", backend_base());

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

    let user = find_or_create_user_by_email(&state, &email).await?;
    let jwt = create_token(
        user.id,
        &user.email,
        &state.config.jwt_secret,
        state.config.jwt_expiry_hours,
    )
    .map_err(|e| AppError::Internal(e))?;

    let url = format!("{}/auth/callback?token={}", state.config.frontend_url, jwt);
    Ok(Redirect::temporary(&url))
}

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
