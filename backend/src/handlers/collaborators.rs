use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    errors::{AppError, Result},
    handlers::auth::verify_token,
    handlers::collab::resolve_collab_role,
    middleware::auth::AuthUser,
    models::{
        project::Project,
    },
    AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CollaboratorResponse {
    pub user_id: Uuid,
    pub email: String,
    pub role: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateInviteRequest {
    pub role: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct InviteClaims {
    sub: Uuid,
    project_id: Uuid,
    role: String,
    exp: i64,
    token_type: String,
}

pub async fn list_collaborators(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<CollaboratorResponse>>> {
    ensure_owner_or_collaborator(&state, project_id, auth.id).await?;

    let owner = sqlx::query_as::<_, (Uuid, String)>(
        r#"SELECT u.id, u.email FROM projects p JOIN users u ON u.id = p.user_id WHERE p.id = $1"#,
    )
    .bind(project_id)
    .fetch_one(&state.db)
    .await?;

    let mut list = vec![CollaboratorResponse {
        user_id: owner.0,
        email: owner.1,
        role: "owner".to_string(),
    }];

    let rows = sqlx::query_as::<_, (Uuid, String, String)>(
        r#"SELECT u.id, u.email, c.role FROM project_collaborators c
           JOIN users u ON u.id = c.user_id WHERE c.project_id = $1"#,
    )
    .bind(project_id)
    .fetch_all(&state.db)
    .await?;

    for (uid, email, role) in rows {
        list.push(CollaboratorResponse {
            user_id: uid,
            email,
            role,
        });
    }

    Ok(Json(list))
}

pub async fn create_invite(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<CreateInviteRequest>,
) -> Result<Json<serde_json::Value>> {
    ensure_owner(&state, project_id, auth.id).await?;

    let role = match body.role.as_str() {
        "viewer" | "editor" => body.role.clone(),
        _ => return Err(AppError::BadRequest("role must be viewer or editor".into())),
    };

    let claims = InviteClaims {
        sub: auth.id,
        project_id,
        role,
        exp: (Utc::now() + Duration::days(7)).timestamp(),
        token_type: "collab_invite".to_string(),
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(e.into()))?;

    let invite_url = format!(
        "{}/ide/{}?invite={}",
        state.config.frontend_url.trim_end_matches('/'),
        project_id,
        urlencoding::encode(&token)
    );

    Ok(Json(serde_json::json!({
        "invite_url": invite_url,
        "token": token,
        "expires_in_days": 7,
    })))
}

#[derive(Debug, Deserialize)]
pub struct JoinInviteQuery {
    pub token: String,
}

pub async fn join_invite(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Query(q): Query<JoinInviteQuery>,
) -> Result<Json<serde_json::Value>> {
    let data = jsonwebtoken::decode::<InviteClaims>(
        &q.token,
        &jsonwebtoken::DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
        &jsonwebtoken::Validation::default(),
    )
    .map_err(|_| AppError::BadRequest("Invalid or expired invite token".into()))?;

    if data.claims.token_type != "collab_invite" || data.claims.project_id != project_id {
        return Err(AppError::BadRequest("Invalid invite token for this project".into()));
    }

    let _ = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = $1")
        .bind(project_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    sqlx::query(
        r#"INSERT INTO project_collaborators (id, project_id, user_id, role, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (project_id, user_id)
           DO UPDATE SET role = EXCLUDED.role"#,
    )
    .bind(Uuid::new_v4())
    .bind(project_id)
    .bind(auth.id)
    .bind(&data.claims.role)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "role": data.claims.role,
        "project_id": project_id,
    })))
}

pub async fn get_my_role(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let role = resolve_collab_role(&state, project_id, auth.id).await?;
    Ok(Json(serde_json::json!({ "role": role })))
}

async fn ensure_owner(state: &AppState, project_id: Uuid, user_id: Uuid) -> Result<()> {
    let project =
        sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = $1 AND user_id = $2")
            .bind(project_id)
            .bind(user_id)
            .fetch_optional(&state.db)
            .await?;

    if project.is_none() {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

async fn ensure_owner_or_collaborator(
    state: &AppState,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<()> {
    let role = resolve_collab_role(state, project_id, user_id).await?;
    if role == "none" {
        return Err(AppError::Forbidden);
    }
    Ok(())
}
