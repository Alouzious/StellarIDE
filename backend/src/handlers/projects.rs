use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    errors::{AppError, Result},
    middleware::auth::AuthUser,
    models::{
        project::{CreateProjectRequest, Project, UpdateProjectRequest},
        project_file::{ProjectFile, SaveFileRequest},
    },
    services::soroban,
    AppState,
};

pub async fn list_projects(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
) -> Result<Json<Vec<Project>>> {
    let projects = sqlx::query_as::<_, Project>(
        "SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC",
    )
    .bind(auth.id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(projects))
}

pub async fn create_project(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Json(body): Json<CreateProjectRequest>,
) -> Result<Json<Project>> {
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("Project name is required".into()));
    }
    let project = sqlx::query_as::<_, Project>(
        r#"INSERT INTO projects (id, user_id, name, description, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           RETURNING *"#,
    )
    .bind(Uuid::new_v4())
    .bind(auth.id)
    .bind(body.name.trim())
    .bind(body.description.as_deref())
    .fetch_one(&state.db)
    .await?;
    Ok(Json(project))
}

pub async fn get_project(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Project>> {
    let project =
        sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = $1 AND user_id = $2")
            .bind(id)
            .bind(auth.id)
            .fetch_optional(&state.db)
            .await?
            .ok_or(AppError::NotFound)?;
    Ok(Json(project))
}

pub async fn update_project(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateProjectRequest>,
) -> Result<Json<Project>> {
    let existing =
        sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = $1 AND user_id = $2")
            .bind(id)
            .bind(auth.id)
            .fetch_optional(&state.db)
            .await?
            .ok_or(AppError::NotFound)?;

    let name = body.name.as_deref().unwrap_or(&existing.name);
    let description = body
        .description
        .as_deref()
        .or(existing.description.as_deref());

    let project = sqlx::query_as::<_, Project>(
        "UPDATE projects SET name=$1, description=$2, updated_at=NOW() WHERE id=$3 RETURNING *",
    )
    .bind(name)
    .bind(description)
    .bind(id)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(project))
}

pub async fn delete_project(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>> {
    let result = sqlx::query("DELETE FROM projects WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(auth.id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(json!({ "message": "Project deleted" })))
}

pub async fn list_files(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<ProjectFile>>> {
    // Ensure project belongs to user
    let _ = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = $1 AND user_id = $2")
        .bind(project_id)
        .bind(auth.id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let files = sqlx::query_as::<_, ProjectFile>(
        "SELECT * FROM project_files WHERE project_id = $1 ORDER BY file_path",
    )
    .bind(project_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(files))
}

pub async fn save_file(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<SaveFileRequest>,
) -> Result<Json<ProjectFile>> {
    // Ensure project belongs to user
    let _ = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = $1 AND user_id = $2")
        .bind(project_id)
        .bind(auth.id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let language = body.language.as_deref().unwrap_or("rust");

    let file = sqlx::query_as::<_, ProjectFile>(
        r#"INSERT INTO project_files (id, project_id, file_path, content, language, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT (project_id, file_path)
           DO UPDATE SET content = EXCLUDED.content, language = EXCLUDED.language, updated_at = NOW()
           RETURNING *"#,
    )
    .bind(Uuid::new_v4())
    .bind(project_id)
    .bind(&body.file_path)
    .bind(&body.content)
    .bind(language)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(file))
}

pub async fn compile_project(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Value>> {
    ensure_project_access(auth.id, project_id, &state).await?;
    let files = load_project_files(project_id, &state).await?;
    let result = soroban::run_compile(project_id, &files, &state.config)
        .await
        .map_err(AppError::Internal)?;

    // Save wasm to project_files so deploy can use it without recompiling
    if let Some(ref wasm_b64) = result.wasm_base64 {
        let _ = sqlx::query(
            r#"INSERT INTO project_files (id, project_id, file_path, content, language, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
               ON CONFLICT (project_id, file_path)
               DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()"#,
        )
        .bind(uuid::Uuid::new_v4())
        .bind(project_id)
        .bind("target/stellaride_contract.wasm")
        .bind(wasm_b64)
        .bind("wasm")
        .execute(&state.db)
        .await;
    }

    Ok(Json(json!(result)))
}

pub async fn test_project(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Value>> {
    ensure_project_access(auth.id, project_id, &state).await?;
    let files = load_project_files(project_id, &state).await?;
    let result = soroban::run_tests(project_id, &files, &state.config)
        .await
        .map_err(AppError::Internal)?;
    Ok(Json(json!(result)))
}

#[derive(Debug, Deserialize)]
pub struct DeployProjectRequest {
    pub wallet_address: Option<String>,
    pub network: Option<String>,
    pub secret_key: Option<String>,
}

pub async fn deploy_project(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<DeployProjectRequest>,
) -> Result<Json<Value>> {
    ensure_project_access(auth.id, project_id, &state).await?;
    let wallet_address = body
        .wallet_address
        .as_deref()
        .unwrap_or("")
        .trim()
        .to_string();
    if wallet_address.is_empty() {
        return Err(AppError::BadRequest(
            "Wallet address is required. Connect Freighter before deploying.".into(),
        ));
    }
    let files = load_project_files(project_id, &state).await?;
    let result = soroban::run_deploy(
        project_id,
        &files,
        &state.config,
        soroban::DeployRequest {
            wallet_address,
            network: body.network,
            secret_key: body.secret_key,
        },
    )
    .await
    .map_err(AppError::Internal)?;
    Ok(Json(json!(result)))
}

pub async fn audit_project(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Value>> {
    ensure_project_access(auth.id, project_id, &state).await?;
    let files = load_project_files(project_id, &state).await?;
    let result = soroban::run_audit(project_id, &files, &state.config)
        .await
        .map_err(AppError::Internal)?;
    Ok(Json(json!(result)))
}

async fn ensure_project_access(user_id: Uuid, project_id: Uuid, state: &AppState) -> Result<()> {
    let _ = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = $1 AND user_id = $2")
        .bind(project_id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(())
}

async fn load_project_files(project_id: Uuid, state: &AppState) -> Result<Vec<ProjectFile>> {
    let files = sqlx::query_as::<_, ProjectFile>(
        "SELECT * FROM project_files WHERE project_id = $1 ORDER BY file_path",
    )
    .bind(project_id)
    .fetch_all(&state.db)
    .await?;
    Ok(files)
}
