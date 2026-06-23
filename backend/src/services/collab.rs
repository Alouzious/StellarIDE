use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc, Mutex,
};
use std::time::Duration;

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use uuid::Uuid;
use yrs::{Doc, ReadTxn, StateVector, Text, Transact};
use yrs::updates::decoder::Decode;
use yrs::Update;

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
        connection_id: Uuid,
        user_id: Uuid,
        name: String,
        color: String,
        role: String,
    },
    Leave {
        connection_id: Uuid,
        user_id: Uuid,
    },
    AwarenessUpdate {
        user_id: Uuid,
        data: String,
    },
    AwarenessRemove {
        user_id: Uuid,
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
    FileTreeError {
        user_id: Uuid,
        action: String,
        file_path: String,
        message: String,
    },
    Presence {
        users: Vec<PresenceUser>,
    },
    CompileOutput {
        user_id: Uuid,
        user_name: String,
        command: String,
        lines: Vec<String>,
        success: bool,
        status: String,
    },
    TestOutput {
        user_id: Uuid,
        user_name: String,
        lines: Vec<String>,
        success: bool,
        status: String,
    },
    DeployStarted {
        user_id: Uuid,
        user_name: String,
    },
    DeployFinished {
        user_id: Uuid,
        success: bool,
        message: String,
    },
    TerminalStarted {
        user_id: Uuid,
        user_name: String,
        operation: String,
    },
    TerminalOutput {
        user_id: Uuid,
        user_name: String,
        operation: String,
        data: String,
    },
    TerminalDone {
        user_id: Uuid,
        user_name: String,
        operation: String,
        success: bool,
        message: String,
    },
    SessionRestored,
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresenceUser {
    pub connection_id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub color: String,
    pub role: String,
}

pub struct Room {
    pub ydoc: Arc<Mutex<Doc>>,
    pub awareness: Arc<tokio::sync::RwLock<std::collections::HashMap<Uuid, String>>>,
    pub presence: Arc<tokio::sync::RwLock<std::collections::HashMap<Uuid, PresenceUser>>>,
    pub tx: broadcast::Sender<String>,
    pub member_count: Arc<AtomicUsize>,
}

impl Room {
    pub fn new(initial_text: &str) -> Self {
        let doc = Doc::new();
        if !initial_text.is_empty() {
            let text = doc.get_or_insert_text("monaco");
            let mut txn = doc.transact_mut();
            text.insert(&mut txn, 0, initial_text);
        }
        let (tx, _) = broadcast::channel(256);
        Self {
            ydoc: Arc::new(Mutex::new(doc)),
            awareness: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
            presence: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
            tx,
            member_count: Arc::new(AtomicUsize::new(0)),
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

    /// Full Yjs document state for late-joining clients (equivalent to Y.encodeStateAsUpdate).
    pub fn encode_full_state(&self) -> Vec<u8> {
        let doc = self.ydoc.lock().expect("ydoc mutex");
        let txn = doc.transact();
        txn.encode_state_as_update_v1(&StateVector::default())
    }

    pub fn ytext_is_empty(&self) -> bool {
        let doc = self.ydoc.lock().expect("ydoc mutex");
        let text = doc.get_or_insert_text("monaco");
        let txn = doc.transact();
        text.len(&txn) == 0
    }

    pub fn apply_yjs_update(&self, bytes: &[u8]) -> Result<(), String> {
        let doc = self.ydoc.lock().expect("ydoc mutex");
        let mut txn = doc.transact_mut();
        let update = Update::decode_v1(bytes).map_err(|e| format!("decode update: {e}"))?;
        txn.apply_update(update)
            .map_err(|e| format!("apply update: {e}"))?;
        Ok(())
    }

    pub fn member_join(&self) {
        self.member_count.fetch_add(1, Ordering::SeqCst);
    }

    pub fn member_leave(&self) -> usize {
        self.member_count
            .fetch_sub(1, Ordering::SeqCst)
            .saturating_sub(1)
    }
}

#[derive(Debug, Clone)]
pub struct DeployLock {
    pub user_id: Uuid,
    pub user_name: String,
}

#[derive(Clone, Default)]
pub struct CollabState {
    pub rooms: Arc<DashMap<RoomKey, Arc<Room>>>,
    pub project_sessions: Arc<DashMap<Uuid, broadcast::Sender<String>>>,
    pub project_presence: Arc<
        DashMap<Uuid, Arc<tokio::sync::RwLock<std::collections::HashMap<Uuid, PresenceUser>>>>,
    >,
    pub project_member_counts: Arc<DashMap<Uuid, Arc<AtomicUsize>>>,
    pub deploy_locks: Arc<DashMap<Uuid, DeployLock>>,
}

const ROOM_EVICTION_GRACE_SECS: u64 = 30;

impl CollabState {
    pub fn new() -> Self {
        Self {
            rooms: Arc::new(DashMap::new()),
            project_sessions: Arc::new(DashMap::new()),
            project_presence: Arc::new(DashMap::new()),
            project_member_counts: Arc::new(DashMap::new()),
            deploy_locks: Arc::new(DashMap::new()),
        }
    }

    pub fn get_or_create_room(&self, key: RoomKey, initial_doc: &str) -> Arc<Room> {
        self.rooms
            .entry(key)
            .or_insert_with(|| Arc::new(Room::new(initial_doc)))
            .clone()
    }

    pub fn schedule_room_eviction(&self, key: RoomKey, room: Arc<Room>) {
        let rooms = self.rooms.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(ROOM_EVICTION_GRACE_SECS)).await;
            if room.member_count.load(Ordering::SeqCst) == 0 {
                rooms.remove(&key);
            }
        });
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

    pub fn project_member_join(&self, project_id: Uuid) {
        let counter = self
            .project_member_counts
            .entry(project_id)
            .or_insert_with(|| Arc::new(AtomicUsize::new(0)))
            .clone();
        counter.fetch_add(1, Ordering::SeqCst);
    }

    pub fn project_member_leave(&self, project_id: Uuid) -> usize {
        let counter = self
            .project_member_counts
            .entry(project_id)
            .or_insert_with(|| Arc::new(AtomicUsize::new(0)))
            .clone();
        counter.fetch_sub(1, Ordering::SeqCst).saturating_sub(1)
    }

    pub fn schedule_project_eviction(&self, project_id: Uuid) {
        let sessions = self.project_sessions.clone();
        let presence = self.project_presence.clone();
        let counters = self.project_member_counts.clone();
        let counter = counters
            .entry(project_id)
            .or_insert_with(|| Arc::new(AtomicUsize::new(0)))
            .clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(ROOM_EVICTION_GRACE_SECS)).await;
            if counter.load(Ordering::SeqCst) == 0 {
                sessions.remove(&project_id);
                presence.remove(&project_id);
                counters.remove(&project_id);
            }
        });
    }

    pub fn broadcast_project(&self, project_id: Uuid, msg: &CollabMessage) {
        if let Some(tx) = self.project_sessions.get(&project_id) {
            if let Ok(json) = serde_json::to_string(msg) {
                let _ = tx.send(json);
            }
        }
    }
}
