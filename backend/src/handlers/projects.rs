use axum::{
    extract::{Path, State},
    http::{header, HeaderValue},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse, Response,
    },
    Extension, Json,
};
use futures_util::StreamExt;
use serde::Deserialize;
use serde_json::{json, Value};
use std::convert::Infallible;
use tokio_stream::wrappers::ReceiverStream;
use uuid::Uuid;

use crate::{
    errors::{AppError, Result},
    handlers::collab::resolve_collab_role,
    middleware::auth::AuthUser,
    models::{
        project::{CreateProjectRequest, Project, UpdateProjectRequest},
        project_file::{ProjectFile, SaveFileRequest},
    },
    services::collab::CollabMessage,
    services::soroban,
    AppState,
};

pub async fn list_projects(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
) -> Result<Json<Vec<Project>>> {
    let projects = sqlx::query_as::<_, Project>(
        r#"(SELECT * FROM projects WHERE user_id = $1
           UNION
           SELECT p.* FROM projects p
           JOIN project_collaborators c ON c.project_id = p.id
           WHERE c.user_id = $1)
           ORDER BY updated_at DESC"#,
    )
    .bind(auth.id)
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
    let role = resolve_collab_role(&state, id, auth.id).await?;
    if role == "none" {
        return Err(AppError::NotFound);
    }

    let project = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = $1")
        .bind(id)
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
    let _ = ensure_project_access(auth.id, project_id, &state).await?;

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
    ensure_editor_access(auth.id, project_id, &state).await?;

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
    ensure_editor_access(auth.id, project_id, &state).await?;
    let project = load_project(project_id, &state).await?;
    let files = load_project_files(project_id, &state).await?;
    let require_cargo = project_requires_cargo(&project);
    let result = soroban::run_compile(project_id, &files, &state.config, require_cargo)
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

    let user_name = user_display_name(&state, auth.id).await;
    state.collab.broadcast_project(
        project_id,
        &CollabMessage::CompileOutput {
            user_id: auth.id,
            user_name,
            command: "cargo build --target wasm32-unknown-unknown --release".into(),
            lines: result.logs.clone(),
            success: result.success,
            status: result.status.clone(),
        },
    );

    Ok(Json(json!(result)))
}

pub async fn test_project(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Value>> {
    ensure_editor_access(auth.id, project_id, &state).await?;
    let project = load_project(project_id, &state).await?;
    let files = load_project_files(project_id, &state).await?;
    let require_cargo = project_requires_cargo(&project);
    let result = soroban::run_tests(project_id, &files, &state.config, require_cargo)
        .await
        .map_err(AppError::Internal)?;

    let user_name = user_display_name(&state, auth.id).await;
    state.collab.broadcast_project(
        project_id,
        &CollabMessage::TestOutput {
            user_id: auth.id,
            user_name,
            lines: result.logs.clone(),
            success: result.success,
            status: result.status.clone(),
        },
    );

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
    ensure_editor_access(auth.id, project_id, &state).await?;

    if let Some(existing) = state.collab.deploy_locks.get(&project_id) {
        if existing.user_id != auth.id {
            return Err(AppError::Conflict(format!(
                "{} is already deploying this project. Wait for it to finish.",
                existing.user_name
            )));
        }
    }

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

    let user_name = user_display_name(&state, auth.id).await;
    state.collab.deploy_locks.insert(
        project_id,
        crate::services::collab::DeployLock {
            user_id: auth.id,
            user_name: user_name.clone(),
        },
    );
    state.collab.broadcast_project(
        project_id,
        &CollabMessage::DeployStarted {
            user_id: auth.id,
            user_name: user_name.clone(),
        },
    );

    let project = load_project(project_id, &state).await?;
    let files = load_project_files(project_id, &state).await?;
    let require_cargo = project_requires_cargo(&project);
    let deploy_result = soroban::run_deploy(
        project_id,
        &files,
        &state.config,
        soroban::DeployRequest {
            wallet_address,
            network: body.network,
            secret_key: body.secret_key,
        },
        require_cargo,
    )
    .await;

    state.collab.deploy_locks.remove(&project_id);

    let result = match deploy_result {
        Ok(r) => r,
        Err(err) => {
            state.collab.broadcast_project(
                project_id,
                &CollabMessage::DeployFinished {
                    user_id: auth.id,
                    success: false,
                    message: err.to_string(),
                },
            );
            return Err(AppError::Internal(err));
        }
    };

    state.collab.broadcast_project(
        project_id,
        &CollabMessage::DeployFinished {
            user_id: auth.id,
            success: result.success,
            message: result.message.clone(),
        },
    );

    Ok(Json(json!(result)))
}

fn sse_response(rx: tokio::sync::mpsc::Receiver<String>) -> Response {
    let stream = ReceiverStream::new(rx).map(|data| -> std::result::Result<Event, Infallible> {
        Ok(Event::default().data(data))
    });
    let mut response = Sse::new(stream)
        .keep_alive(KeepAlive::default())
        .into_response();
    let headers = response.headers_mut();
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    headers.insert(
        header::HeaderName::from_static("x-accel-buffering"),
        HeaderValue::from_static("no"),
    );
    response
}

fn terminal_line_sink(
    tx: tokio::sync::mpsc::Sender<String>,
    state: AppState,
    project_id: Uuid,
    user_id: Uuid,
    user_name: String,
    operation: &'static str,
) -> soroban::LineSink {
    soroban::line_sink(move |line| {
        let _ = tx.try_send(line.clone());
        state.collab.broadcast_project(
            project_id,
            &CollabMessage::TerminalOutput {
                user_id,
                user_name: user_name.clone(),
                operation: operation.to_string(),
                data: line,
            },
        );
    })
}

pub async fn compile_project_stream(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<Response> {
    ensure_editor_access(auth.id, project_id, &state).await?;
    let project = load_project(project_id, &state).await?;
    let files = load_project_files(project_id, &state).await?;
    let require_cargo = project_requires_cargo(&project);
    let user_name = user_display_name(&state, auth.id).await;

    let (tx, rx) = tokio::sync::mpsc::channel::<String>(512);
    let state_bg = state.clone();
    let auth_id = auth.id;

    tokio::spawn(async move {
        state_bg.collab.broadcast_project(
            project_id,
            &CollabMessage::TerminalStarted {
                user_id: auth_id,
                user_name: user_name.clone(),
                operation: "compile".into(),
            },
        );

        let on_line = terminal_line_sink(
            tx.clone(),
            state_bg.clone(),
            project_id,
            auth_id,
            user_name.clone(),
            "compile",
        );

        let result = soroban::run_compile_stream(
            project_id,
            &files,
            &state_bg.config,
            require_cargo,
            on_line,
        )
        .await;

        match result {
            Ok(r) => {
                if let Some(ref wasm_b64) = r.wasm_base64 {
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
                    .execute(&state_bg.db)
                    .await;
                }

                if r.success {
                    let _ = tx.send("[DONE]".into()).await;
                } else {
                    let _ = tx.send("[ERROR] exit code 1".into()).await;
                }

                state_bg.collab.broadcast_project(
                    project_id,
                    &CollabMessage::CompileOutput {
                        user_id: auth_id,
                        user_name: user_name.clone(),
                        command: "cargo build --target wasm32-unknown-unknown --release".into(),
                        lines: vec![],
                        success: r.success,
                        status: r.status.clone(),
                    },
                );
                state_bg.collab.broadcast_project(
                    project_id,
                    &CollabMessage::TerminalDone {
                        user_id: auth_id,
                        user_name,
                        operation: "compile".into(),
                        success: r.success,
                        message: r.message,
                    },
                );
            }
            Err(err) => {
                let _ = tx
                    .send(format!("[ERROR] exit code 1 — {err}"))
                    .await;
            }
        }
    });

    Ok(sse_response(rx))
}

pub async fn test_project_stream(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<Response> {
    ensure_editor_access(auth.id, project_id, &state).await?;
    let project = load_project(project_id, &state).await?;
    let files = load_project_files(project_id, &state).await?;
    let require_cargo = project_requires_cargo(&project);
    let user_name = user_display_name(&state, auth.id).await;

    let (tx, rx) = tokio::sync::mpsc::channel::<String>(512);
    let state_bg = state.clone();
    let auth_id = auth.id;

    tokio::spawn(async move {
        state_bg.collab.broadcast_project(
            project_id,
            &CollabMessage::TerminalStarted {
                user_id: auth_id,
                user_name: user_name.clone(),
                operation: "test".into(),
            },
        );

        let on_line = terminal_line_sink(
            tx.clone(),
            state_bg.clone(),
            project_id,
            auth_id,
            user_name.clone(),
            "test",
        );

        let result = soroban::run_tests_stream(
            project_id,
            &files,
            &state_bg.config,
            require_cargo,
            on_line,
        )
        .await;

        match result {
            Ok(r) => {
                if r.success {
                    let _ = tx.send("[DONE]".into()).await;
                } else {
                    let _ = tx.send("[ERROR] exit code 1".into()).await;
                }

                state_bg.collab.broadcast_project(
                    project_id,
                    &CollabMessage::TestOutput {
                        user_id: auth_id,
                        user_name: user_name.clone(),
                        lines: vec![],
                        success: r.success,
                        status: r.status.clone(),
                    },
                );
                state_bg.collab.broadcast_project(
                    project_id,
                    &CollabMessage::TerminalDone {
                        user_id: auth_id,
                        user_name,
                        operation: "test".into(),
                        success: r.success,
                        message: r.message,
                    },
                );
            }
            Err(err) => {
                let _ = tx
                    .send(format!("[ERROR] exit code 1 — {err}"))
                    .await;
            }
        }
    });

    Ok(sse_response(rx))
}

pub async fn deploy_project_stream(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<DeployProjectRequest>,
) -> Result<Response> {
    ensure_editor_access(auth.id, project_id, &state).await?;

    if let Some(existing) = state.collab.deploy_locks.get(&project_id) {
        if existing.user_id != auth.id {
            return Err(AppError::Conflict(format!(
                "{} is already deploying this project. Wait for it to finish.",
                existing.user_name
            )));
        }
    }

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

    let user_name = user_display_name(&state, auth.id).await;
    state.collab.deploy_locks.insert(
        project_id,
        crate::services::collab::DeployLock {
            user_id: auth.id,
            user_name: user_name.clone(),
        },
    );
    state.collab.broadcast_project(
        project_id,
        &CollabMessage::DeployStarted {
            user_id: auth.id,
            user_name: user_name.clone(),
        },
    );

    let project = load_project(project_id, &state).await?;
    let files = load_project_files(project_id, &state).await?;
    let require_cargo = project_requires_cargo(&project);

    let (tx, rx) = tokio::sync::mpsc::channel::<String>(512);
    let state_bg = state.clone();
    let auth_id = auth.id;
    let deploy_request = soroban::DeployRequest {
        wallet_address,
        network: body.network,
        secret_key: body.secret_key,
    };

    tokio::spawn(async move {
        state_bg.collab.broadcast_project(
            project_id,
            &CollabMessage::TerminalStarted {
                user_id: auth_id,
                user_name: user_name.clone(),
                operation: "deploy".into(),
            },
        );

        let on_line = terminal_line_sink(
            tx.clone(),
            state_bg.clone(),
            project_id,
            auth_id,
            user_name.clone(),
            "deploy",
        );

        let deploy_result = soroban::run_deploy_stream(
            project_id,
            &files,
            &state_bg.config,
            deploy_request,
            require_cargo,
            on_line,
        )
        .await;

        state_bg.collab.deploy_locks.remove(&project_id);

        match deploy_result {
            Ok(r) => {
                if r.success {
                    let _ = tx.send("[DONE]".into()).await;
                } else {
                    let _ = tx.send("[ERROR] exit code 1".into()).await;
                }

                state_bg.collab.broadcast_project(
                    project_id,
                    &CollabMessage::DeployFinished {
                        user_id: auth_id,
                        success: r.success,
                        message: r.message.clone(),
                    },
                );
                state_bg.collab.broadcast_project(
                    project_id,
                    &CollabMessage::TerminalDone {
                        user_id: auth_id,
                        user_name,
                        operation: "deploy".into(),
                        success: r.success,
                        message: r.message,
                    },
                );
            }
            Err(err) => {
                state_bg.collab.broadcast_project(
                    project_id,
                    &CollabMessage::DeployFinished {
                        user_id: auth_id,
                        success: false,
                        message: err.to_string(),
                    },
                );
                let _ = tx
                    .send(format!("[ERROR] exit code 1 — {err}"))
                    .await;
            }
        }
    });

    Ok(sse_response(rx))
}

pub async fn audit_project(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Value>> {
    ensure_editor_access(auth.id, project_id, &state).await?;
    let project = load_project(project_id, &state).await?;
    let files = load_project_files(project_id, &state).await?;
    let require_cargo = project_requires_cargo(&project);
    let result = soroban::run_audit(project_id, &files, &state.config, require_cargo)
        .await
        .map_err(AppError::Internal)?;
    Ok(Json(json!(result)))
}

async fn ensure_project_access(user_id: Uuid, project_id: Uuid, state: &AppState) -> Result<()> {
    let role = resolve_collab_role(state, project_id, user_id).await?;
    if role == "none" {
        return Err(AppError::NotFound);
    }
    Ok(())
}

async fn ensure_editor_access(user_id: Uuid, project_id: Uuid, state: &AppState) -> Result<()> {
    let role = resolve_collab_role(state, project_id, user_id).await?;
    if role == "none" || role == "viewer" {
        return Err(AppError::Forbidden);
    }
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

async fn load_project(project_id: Uuid, state: &AppState) -> Result<Project> {
    sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = $1")
        .bind(project_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)
}

async fn user_display_name(state: &AppState, user_id: Uuid) -> String {
    sqlx::query_scalar::<_, String>("SELECT email FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()
        .map(|email| email.split('@').next().unwrap_or("user").to_string())
        .unwrap_or_else(|| "user".to_string())
}

fn project_requires_cargo(project: &Project) -> bool {
    project.github_owner.is_some()
        || project.github_repo.is_some()
        || project.github_subfolder.is_some()
}
