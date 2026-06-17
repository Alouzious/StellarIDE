use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    response::IntoResponse,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    errors::{AppError, Result},
    handlers::auth::verify_token,
    models::project::Project,
    services::collab::{CollabMessage, PresenceUser, RoomKey},
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct CollabQuery {
    pub token: String,
    pub file: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ProjectCollabQuery {
    pub token: String,
}

pub async fn collab_ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Query(query): Query<CollabQuery>,
) -> Result<impl IntoResponse> {
    let claims = verify_token(&query.token, &state.config.jwt_secret)
        .map_err(|_| AppError::Unauthorized)?;

    let role = resolve_collab_role(&state, project_id, claims.sub).await?;
    if role == "none" {
        return Err(AppError::Forbidden);
    }

    let file_path = query
        .file
        .filter(|f| !f.is_empty())
        .unwrap_or_else(|| "src/lib.rs".to_string());

    let user = sqlx::query_as::<_, crate::models::user::User>(
        "SELECT * FROM users WHERE id = $1",
    )
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let initial_content = load_file_content(&state, project_id, &file_path).await?;
    let initial_doc = BASE64.encode(initial_content.as_bytes());

    let name = user.email.split('@').next().unwrap_or("user").to_string();
    let color = color_for_user(claims.sub);

    Ok(ws.on_upgrade(move |socket| {
        handle_collab_socket(
            socket,
            state,
            project_id,
            file_path,
            claims.sub,
            name,
            color,
            role,
            initial_doc,
        )
    }))
}

pub async fn project_collab_ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Query(query): Query<ProjectCollabQuery>,
) -> Result<impl IntoResponse> {
    let claims = verify_token(&query.token, &state.config.jwt_secret)
        .map_err(|_| AppError::Unauthorized)?;

    let role = resolve_collab_role(&state, project_id, claims.sub).await?;
    if role == "none" {
        return Err(AppError::Forbidden);
    }

    let user = sqlx::query_as::<_, crate::models::user::User>(
        "SELECT * FROM users WHERE id = $1",
    )
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let name = user.email.split('@').next().unwrap_or("user").to_string();
    let color = color_for_user(claims.sub);

    Ok(ws.on_upgrade(move |socket| {
        handle_project_collab_socket(socket, state, project_id, claims.sub, name, color, role)
    }))
}

async fn handle_collab_socket(
    socket: WebSocket,
    state: AppState,
    project_id: Uuid,
    file_path: String,
    user_id: Uuid,
    name: String,
    color: String,
    role: String,
    initial_doc_b64: String,
) {
    let collab = state.collab.clone();
    let room_key = RoomKey {
        project_id,
        file_path: file_path.clone(),
    };

    let initial_bytes = BASE64
        .decode(&initial_doc_b64)
        .unwrap_or_default();
    let room = collab.get_or_create_room(room_key.clone(), initial_bytes);

    {
        let mut presence = room.presence.write().await;
        presence.insert(
            user_id,
            PresenceUser {
                user_id,
                name: name.clone(),
                color: color.clone(),
                role: role.clone(),
            },
        );
    }

    let join_msg = CollabMessage::Join {
        user_id,
        name: name.clone(),
        color: color.clone(),
        role: role.clone(),
    };
    room.broadcast(&join_msg);
    send_presence(&room).await;

    let mut rx = room.subscribe();
    let (mut sender, mut receiver) = socket.split();

    // Send current doc state to joining client
    let doc_state = room.doc_state.read().await.clone();
    if !doc_state.is_empty() {
        let doc_msg = CollabMessage::DocUpdate {
            user_id: Uuid::nil(),
            data: BASE64.encode(&doc_state),
        };
        if let Ok(json) = serde_json::to_string(&doc_msg) {
            let _ = sender.send(Message::Text(json.into())).await;
        }
    } else if !initial_doc_b64.is_empty() {
        let doc_msg = CollabMessage::DocUpdate {
            user_id: Uuid::nil(),
            data: initial_doc_b64,
        };
        if let Ok(json) = serde_json::to_string(&doc_msg) {
            let _ = sender.send(Message::Text(json.into())).await;
        }
    }

    // Send awareness states
    {
        let awareness = room.awareness.read().await;
        for (uid, data) in awareness.iter() {
            if *uid != user_id {
                let msg = CollabMessage::AwarenessUpdate {
                    user_id: *uid,
                    data: data.clone(),
                };
                if let Ok(json) = serde_json::to_string(&msg) {
                    let _ = sender.send(Message::Text(json.into())).await;
                }
            }
        }
    }

    let presence_snapshot = {
        let presence = room.presence.read().await;
        CollabMessage::Presence {
            users: presence.values().cloned().collect(),
        }
    };
    if let Ok(json) = serde_json::to_string(&presence_snapshot) {
        let _ = sender.send(Message::Text(json.into())).await;
    }

    let room_broadcast = room.clone();
    let user_id_recv = user_id;
    let role_recv = role.clone();
    let _file_path_persist = file_path.clone();
    let _state_persist = state.clone();
    let _project_id_persist = project_id;

    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    if let Ok(parsed) = serde_json::from_str::<CollabMessage>(&text) {
                        match parsed {
                            CollabMessage::DocUpdate { user_id: uid, data } => {
                                if role_recv == "viewer" {
                                    continue;
                                }
                                if uid == user_id_recv {
                                    if let Ok(bytes) = BASE64.decode(&data) {
                                        let mut doc = room_broadcast.doc_state.write().await;
                                        *doc = bytes;
                                    }
                                    let broadcast = CollabMessage::DocUpdate {
                                        user_id: uid,
                                        data,
                                    };
                                    room_broadcast.broadcast(&broadcast);
                                }
                            }
                            CollabMessage::AwarenessUpdate { user_id: uid, data } => {
                                let mut awareness = room_broadcast.awareness.write().await;
                                awareness.insert(uid, data.clone());
                                room_broadcast.broadcast(&CollabMessage::AwarenessUpdate {
                                    user_id: uid,
                                    data,
                                });
                            }
                            CollabMessage::Leave { user_id: uid } if uid == user_id_recv => {
                                break;
                            }
                            _ => {}
                        }
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    let room_fwd = room.clone();
    let user_id_fwd = user_id;
    let fwd_task = tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(json) => {
                    if let Ok(parsed) = serde_json::from_str::<CollabMessage>(&json) {
                        if let CollabMessage::DocUpdate { user_id: uid, .. } = &parsed {
                            if *uid == user_id_fwd {
                                continue;
                            }
                        }
                        if let CollabMessage::AwarenessUpdate { user_id: uid, .. } = &parsed {
                            if *uid == user_id_fwd {
                                continue;
                            }
                        }
                        if let CollabMessage::Join { user_id: uid, .. } = &parsed {
                            if *uid == user_id_fwd {
                                continue;
                            }
                        }
                    }
                    if sender.send(Message::Text(json.into())).await.is_err() {
                        break;
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(_) => break,
            }
        }
    });

    tokio::select! {
        _ = recv_task => {},
        _ = fwd_task => {},
    }

    {
        let mut presence = room.presence.write().await;
        presence.remove(&user_id);
        let mut awareness = room.awareness.write().await;
        awareness.remove(&user_id);
    }
    room.broadcast(&CollabMessage::Leave { user_id });
    send_presence(&room).await;
}

async fn handle_project_collab_socket(
    socket: WebSocket,
    state: AppState,
    project_id: Uuid,
    user_id: Uuid,
    name: String,
    color: String,
    role: String,
) {
    let collab = state.collab.clone();
    let tx = collab.get_project_broadcast(project_id);
    let mut rx = tx.subscribe();
    let presence_map = collab.get_project_presence(project_id);

    {
        let mut presence = presence_map.write().await;
        presence.insert(
            user_id,
            PresenceUser {
                user_id,
                name: name.clone(),
                color: color.clone(),
                role: role.clone(),
            },
        );
    }

    let join = CollabMessage::Join {
        user_id,
        name: name.clone(),
        color: color.clone(),
        role: role.clone(),
    };
    if let Ok(json) = serde_json::to_string(&join) {
        let _ = tx.send(json);
    }

    let users: Vec<PresenceUser> = {
        let presence = presence_map.read().await;
        presence.values().cloned().collect()
    };
    if let Ok(json) = serde_json::to_string(&CollabMessage::Presence { users }) {
        let _ = tx.send(json);
    }

    let (mut sender, mut receiver) = socket.split();

    let tx_send = tx.clone();
    let user_id_recv = user_id;
    let role_recv = role;
    let state_fs = state.clone();

    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                if let Ok(parsed) = serde_json::from_str::<CollabMessage>(&text) {
                    match &parsed {
                        CollabMessage::FileTreeUpdate {
                            user_id: uid,
                            action,
                            file_path,
                            content,
                            language,
                            old_path,
                        } if *uid == user_id_recv && role_recv != "viewer" => {
                            if persist_file_tree_change(
                                &state_fs,
                                project_id,
                                action,
                                file_path,
                                content.as_deref(),
                                language.as_deref(),
                                old_path.as_deref(),
                            )
                            .await
                            .is_ok()
                            {
                                if let Ok(json) = serde_json::to_string(&parsed) {
                                    let _ = tx_send.send(json);
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    });

    let user_id_fwd = user_id;
    let fwd_task = tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(json) => {
                    if let Ok(parsed) = serde_json::from_str::<CollabMessage>(&json) {
                        if let CollabMessage::FileTreeUpdate { user_id: uid, .. } = &parsed {
                            if *uid == user_id_fwd {
                                continue;
                            }
                        }
                    }
                    if sender.send(Message::Text(json.into())).await.is_err() {
                        break;
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(_) => break,
            }
        }
    });

    tokio::select! {
        _ = recv_task => {},
        _ = fwd_task => {},
    }

    {
        let mut presence = presence_map.write().await;
        presence.remove(&user_id);
    }
    if let Ok(json) = serde_json::to_string(&CollabMessage::Leave { user_id }) {
        let _ = tx.send(json);
    }
    let users: Vec<PresenceUser> = {
        let presence = presence_map.read().await;
        presence.values().cloned().collect()
    };
    if let Ok(json) = serde_json::to_string(&CollabMessage::Presence { users }) {
        let _ = tx.send(json);
    }
}

async fn send_presence(room: &Arc<crate::services::collab::Room>) {
    let users: Vec<PresenceUser> = {
        let presence = room.presence.read().await;
        presence.values().cloned().collect()
    };
    room.broadcast(&CollabMessage::Presence { users });
}

async fn persist_file_tree_change(
    state: &AppState,
    project_id: Uuid,
    action: &str,
    file_path: &str,
    content: Option<&str>,
    language: Option<&str>,
    old_path: Option<&str>,
) -> Result<()> {
    match action {
        "create" | "update" => {
            let lang = language.unwrap_or("rust");
            let body = content.unwrap_or("");
            sqlx::query(
                r#"INSERT INTO project_files (id, project_id, file_path, content, language, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                   ON CONFLICT (project_id, file_path)
                   DO UPDATE SET content = EXCLUDED.content, language = EXCLUDED.language, updated_at = NOW()"#,
            )
            .bind(Uuid::new_v4())
            .bind(project_id)
            .bind(file_path)
            .bind(body)
            .bind(lang)
            .execute(&state.db)
            .await?;
        }
        "delete" => {
            sqlx::query("DELETE FROM project_files WHERE project_id = $1 AND file_path = $2")
                .bind(project_id)
                .bind(file_path)
                .execute(&state.db)
                .await?;
        }
        "rename" => {
            if let Some(old) = old_path {
                sqlx::query(
                    "UPDATE project_files SET file_path = $1, updated_at = NOW() WHERE project_id = $2 AND file_path = $3",
                )
                .bind(file_path)
                .bind(project_id)
                .bind(old)
                .execute(&state.db)
                .await?;
            }
        }
        _ => {}
    }
    Ok(())
}

async fn load_file_content(state: &AppState, project_id: Uuid, file_path: &str) -> Result<String> {
    let row = sqlx::query_as::<_, (String,)>(
        "SELECT content FROM project_files WHERE project_id = $1 AND file_path = $2",
    )
    .bind(project_id)
    .bind(file_path)
    .fetch_optional(&state.db)
    .await?;

    Ok(row.map(|r| r.0).unwrap_or_default())
}

pub async fn resolve_collab_role(
    state: &AppState,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<String> {
    let project =
        sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = $1")
            .bind(project_id)
            .fetch_optional(&state.db)
            .await?;

    let Some(project) = project else {
        return Ok("none".to_string());
    };

    if project.user_id == user_id {
        return Ok("owner".to_string());
    }

    let role = sqlx::query_scalar::<_, String>(
        "SELECT role FROM project_collaborators WHERE project_id = $1 AND user_id = $2",
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;

    Ok(role.unwrap_or_else(|| "none".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collab_message_serializes_with_type_tag() {
        let msg = CollabMessage::Join {
            user_id: Uuid::nil(),
            name: "alice".into(),
            color: "#FF6B6B".into(),
            role: "editor".into(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"type\":\"join\""));
        assert!(json.contains("\"name\":\"alice\""));
    }
}

fn color_for_user(user_id: Uuid) -> String {
    const COLORS: &[&str] = &[
        "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
    ];
    let idx = (user_id.as_u128() as usize) % COLORS.len();
    COLORS[idx].to_string()
}

use std::sync::Arc;
