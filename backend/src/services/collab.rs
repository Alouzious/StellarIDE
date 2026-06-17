use std::sync::Arc;

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use uuid::Uuid;

/// Unique key for a collaboration session: project + file path
#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct RoomKey {
    pub project_id: Uuid,
    pub file_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum CollabMessage {
    Join {
        user_id: Uuid,
        name: String,
        color: String,
        role: String,
    },
    Leave {
        user_id: Uuid,
    },
    AwarenessUpdate {
        user_id: Uuid,
        data: String,
    },
    DocUpdate {
        user_id: Uuid,
        data: String,
    },
    FileTreeUpdate {
        user_id: Uuid,
        action: String,
        file_path: String,
        content: Option<String>,
        language: Option<String>,
        old_path: Option<String>,
    },
    Presence {
        users: Vec<PresenceUser>,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresenceUser {
    pub user_id: Uuid,
    pub name: String,
    pub color: String,
    pub role: String,
}

pub struct Room {
    pub doc_state: Arc<tokio::sync::RwLock<Vec<u8>>>,
    pub awareness: Arc<tokio::sync::RwLock<std::collections::HashMap<Uuid, String>>>,
    pub presence: Arc<tokio::sync::RwLock<std::collections::HashMap<Uuid, PresenceUser>>>,
    pub tx: broadcast::Sender<String>,
}

impl Room {
    pub fn new(initial_doc: Vec<u8>) -> Self {
        let (tx, _) = broadcast::channel(256);
        Self {
            doc_state: Arc::new(tokio::sync::RwLock::new(initial_doc)),
            awareness: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
            presence: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
            tx,
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<String> {
        self.tx.subscribe()
    }

    pub fn broadcast(&self, msg: &CollabMessage) {
        if let Ok(json) = serde_json::to_string(msg) {
            let _ = self.tx.send(json);
        }
    }
}

#[derive(Clone, Default)]
pub struct CollabState {
    pub rooms: Arc<DashMap<RoomKey, Arc<Room>>>,
    pub project_sessions: Arc<DashMap<Uuid, broadcast::Sender<String>>>,
    pub project_presence: Arc<DashMap<Uuid, Arc<tokio::sync::RwLock<std::collections::HashMap<Uuid, PresenceUser>>>>>,
}

impl CollabState {
    pub fn new() -> Self {
        Self {
            rooms: Arc::new(DashMap::new()),
            project_sessions: Arc::new(DashMap::new()),
            project_presence: Arc::new(DashMap::new()),
        }
    }

    pub fn get_or_create_room(&self, key: RoomKey, initial_doc: Vec<u8>) -> Arc<Room> {
        self.rooms
            .entry(key)
            .or_insert_with(|| Arc::new(Room::new(initial_doc)))
            .clone()
    }

    pub fn get_project_broadcast(&self, project_id: Uuid) -> broadcast::Sender<String> {
        self.project_sessions
            .entry(project_id)
            .or_insert_with(|| {
                let (tx, _) = broadcast::channel(256);
                tx
            })
            .clone()
    }

    pub fn get_project_presence(
        &self,
        project_id: Uuid,
    ) -> Arc<tokio::sync::RwLock<std::collections::HashMap<Uuid, PresenceUser>>> {
        self.project_presence
            .entry(project_id)
            .or_insert_with(|| Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())))
            .clone()
    }
}
