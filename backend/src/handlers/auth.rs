use axum::{extract::State, Extension, Json};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    errors::{AppError, Result},
    middleware::auth::AuthUser,
    models::user::{AuthResponse, LoginRequest, RegisterRequest, User, UserResponse},
    AppState,
};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: Uuid,
    pub email: String,
    pub exp: i64,
}

pub fn create_token(user_id: Uuid, email: &str, secret: &str, expiry_hours: i64) -> anyhow::Result<String> {
    let claims = Claims {
        sub: user_id,
        email: email.to_string(),
        exp: (Utc::now() + Duration::hours(expiry_hours)).timestamp(),
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?;
    Ok(token)
}

pub fn verify_token(token: &str, secret: &str) -> anyhow::Result<Claims> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(data.claims)
}

pub async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>> {
    // Validate input
    if body.email.is_empty() || !body.email.contains('@') {
        return Err(AppError::BadRequest("Invalid email address".into()));
    }
    if body.password.len() < 8 {
        return Err(AppError::BadRequest("Password must be at least 8 characters".into()));
    }

    // Check if email already in use
    let existing = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users WHERE email = $1")
        .bind(&body.email)
        .fetch_one(&state.db)
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    if existing > 0 {
        return Err(AppError::Conflict("Email already in use".into()));
    }

    let hash = bcrypt::hash(&body.password, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    let user = sqlx::query_as::<_, User>(
        r#"INSERT INTO users (id, email, password_hash, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           RETURNING *"#,
    )
    .bind(Uuid::new_v4())
    .bind(&body.email)
    .bind(&hash)
    .fetch_one(&state.db)
    .await?;

    let token = create_token(user.id, &user.email, &state.config.jwt_secret, state.config.jwt_expiry_hours)
        .map_err(|e| AppError::Internal(e))?;

    Ok(Json(AuthResponse { token, user: user.into() }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<AuthResponse>> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&body.email)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| AppError::Internal(e.into()))?
        .ok_or(AppError::Unauthorized)?;

    let valid = bcrypt::verify(&body.password, &user.password_hash)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    if !valid {
        return Err(AppError::Unauthorized);
    }

    let token = create_token(user.id, &user.email, &state.config.jwt_secret, state.config.jwt_expiry_hours)
        .map_err(|e| AppError::Internal(e))?;

    Ok(Json(AuthResponse { token, user: user.into() }))
}

pub async fn me(
    Extension(auth_user): Extension<AuthUser>,
    State(state): State<AppState>,
) -> Result<Json<UserResponse>> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(auth_user.id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| AppError::Internal(e.into()))?
        .ok_or(AppError::NotFound)?;

    Ok(Json(user.into()))
}
