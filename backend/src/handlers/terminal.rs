use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{
    errors::{AppError, Result},
    handlers::{
        auth::verify_token,
        projects::{ensure_editor_access, load_project, load_project_files},
    },
    services::terminal::{self, project_requires_cargo, SessionKey},
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct TerminalQuery {
    pub token: String,
    pub session: Option<String>,
}

pub async fn terminal_ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Query(query): Query<TerminalQuery>,
) -> Result<impl IntoResponse> {
    let claims = verify_token(&query.token, &state.config.jwt_secret)
        .map_err(|_| AppError::Unauthorized)?;

    ensure_editor_access(claims.sub, project_id, &state).await?;

    let project = load_project(project_id, &state).await?;
    let files = load_project_files(project_id, &state).await?;
    let require_cargo = project_requires_cargo(&project);

    let user_name = sqlx::query_scalar::<_, String>("SELECT email FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_optional(&state.db)
        .await?
        .map(|email| email.split('@').next().unwrap_or("user").to_string())
        .unwrap_or_else(|| "user".to_string());

    let session_id = query
        .session
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let session_key = SessionKey {
        project_id,
        user_id: claims.sub,
        session_id: session_id.clone(),
    };

    if let Some(existing) = state.terminal.sessions.get(&session_key) {
        if let Some(tx) = existing.kill_tx.lock().await.take() {
            let _ = tx.send(());
        }
    }

    Ok(ws.on_upgrade(move |socket| {
        handle_terminal_socket(
            socket,
            state,
            project_id,
            claims.sub,
            user_name,
            session_id,
            files,
            require_cargo,
        )
    }))
}

async fn handle_terminal_socket(
    socket: WebSocket,
    state: AppState,
    project_id: Uuid,
    user_id: Uuid,
    user_name: String,
    session_id: String,
    files: Vec<crate::models::project_file::ProjectFile>,
    require_cargo: bool,
) {
    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (out_tx, mut out_rx) = mpsc::unbounded_channel::<Message>();
    let (in_tx, in_rx) = mpsc::unbounded_channel::<Message>();

    let forward_out = tokio::spawn(async move {
        while let Some(msg) = out_rx.recv().await {
            if ws_sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    let forward_in = tokio::spawn(async move {
        while let Some(result) = ws_receiver.next().await {
            match result {
                Ok(msg) => {
                    if in_tx.send(msg).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    let result = terminal::run_session(
        state.clone(),
        project_id,
        user_id,
        user_name,
        session_id,
        out_tx,
        in_rx,
        files,
        require_cargo,
        80,
        24,
    )
    .await;

    if let Err(err) = result {
        let _ = forward_out.abort();
        let _ = forward_in.abort();
        tracing::warn!("Terminal session ended with error: {err}");
    } else {
        forward_out.abort();
        forward_in.abort();
    }
}
