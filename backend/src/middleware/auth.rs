use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use uuid::Uuid;
use crate::{errors::AppError, AppState};

#[derive(Clone, Debug)]
pub struct AuthUser {
    pub id: Uuid,
    #[allow(dead_code)]
    pub email: String,
}

pub async fn require_auth(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let auth_header = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or(AppError::Unauthorized)?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or(AppError::Unauthorized)?;

    let claims = crate::handlers::auth::verify_token(token, &state.config.jwt_secret)
        .map_err(|_| AppError::Unauthorized)?;

    req.extensions_mut().insert(AuthUser {
        id: claims.sub,
        email: claims.email,
    });

    Ok(next.run(req).await)
}
