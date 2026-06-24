use std::{
    collections::HashMap,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::Arc,
    time::{Duration, Instant},
};

use anyhow::{anyhow, Context};
use dashmap::DashMap;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use tokio::sync::{mpsc, oneshot, Mutex};
use uuid::Uuid;

use crate::{
    config::Config,
    models::project_file::ProjectFile,
    services::collab::CollabMessage,
    services::soroban,
    AppState,
};

const IDLE_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const MAX_SESSIONS_PER_USER: usize = 5;
const READ_BUF: usize = 4096;

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct SessionKey {
    pub project_id: Uuid,
    pub user_id: Uuid,
    pub session_id: String,
}

pub struct TerminalState {
    sessions: DashMap<SessionKey, Arc<SessionEntry>>,
}

struct SessionEntry {
    kill_tx: Mutex<Option<oneshot::Sender<()>>>,
    last_activity: Mutex<Instant>,
}

impl TerminalState {
    pub fn new() -> Self {
        Self {
            sessions: DashMap::new(),
        }
    }

    pub fn session_count_for_user(&self, project_id: Uuid, user_id: Uuid) -> usize {
        self.sessions
            .iter()
            .filter(|entry| entry.key().project_id == project_id && entry.key().user_id == user_id)
            .count()
    }

    pub fn register(&self, key: SessionKey, kill_tx: oneshot::Sender<()>) {
        self.sessions.insert(
            key,
            Arc::new(SessionEntry {
                kill_tx: Mutex::new(Some(kill_tx)),
                last_activity: Mutex::new(Instant::now()),
            }),
        );
    }

    pub async fn touch(&self, key: &SessionKey) {
        if let Some(entry) = self.sessions.get(key) {
            *entry.last_activity.lock().await = Instant::now();
        }
    }

    pub async fn remove(&self, key: &SessionKey) {
        if let Some((_, entry)) = self.sessions.remove(key) {
            if let Some(tx) = entry.kill_tx.lock().await.take() {
                let _ = tx.send(());
            }
        }
    }

    pub async fn kill_existing_session(&self, key: &SessionKey) {
        self.remove(key).await;
    }
}

#[derive(Debug, serde::Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TerminalControlMessage {
    Resize { cols: u16, rows: u16 },
    Share { enabled: bool },
}

pub async fn sync_terminal_workspace(
    project_id: Uuid,
    files: &[ProjectFile],
    sdk_version: &str,
    require_cargo_toml: bool,
) -> anyhow::Result<PathBuf> {
    let root = workspace_root(project_id);
    if root.exists() {
        tokio::fs::remove_dir_all(&root).await.ok();
    }
    tokio::fs::create_dir_all(&root).await?;

    let mut has_cargo_toml = false;
    for file in files {
        let safe_path = soroban::sanitize_relative_path(&file.file_path)
            .with_context(|| format!("Invalid file path {}", file.file_path))?;
        if safe_path == Path::new("Cargo.toml") {
            has_cargo_toml = true;
        }
        if safe_path.extension().map_or(false, |e| e == "wasm") {
            continue;
        }
        let destination = root.join(&safe_path);
        if let Some(parent) = destination.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        tokio::fs::write(destination, &file.content).await?;
    }

    if !has_cargo_toml {
        if require_cargo_toml {
            soroban::cleanup_workspace(&root).await;
            return Err(anyhow!(soroban::NO_CARGO_MSG));
        }
        tokio::fs::write(
            root.join("Cargo.toml"),
            soroban::default_cargo_toml_content(sdk_version),
        )
        .await?;
        tokio::fs::create_dir_all(root.join("src")).await?;
        tokio::fs::write(root.join("src/lib.rs"), soroban::default_contract_content()).await?;
    }

    write_bashrc(&root).await?;
    Ok(root)
}

fn workspace_root(project_id: Uuid) -> PathBuf {
    std::env::temp_dir()
        .join("stellaride")
        .join("projects")
        .join(project_id.to_string())
        .join("terminal")
}

async fn write_bashrc(workspace: &Path) -> anyhow::Result<()> {
    let bashrc = r#"# StellarIDE interactive terminal
export TERM=xterm-256color
export PATH="/usr/local/cargo/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export PS1="\[\033[1;34m\]\W\[\033[0m\] \$ "

help() {
  cat <<'EOF'
StellarIDE Terminal - Available Commands:

Soroban:
  cargo build          Compile contract to WASM
  cargo test           Run contract tests
  cargo clippy         Lint your contract
  stellar contract invoke --help   Invoke deployed contract

Files:
  ls, cat, pwd, cd, mkdir, touch

Git:
  git status, git log, git diff

IDE buttons (Compile/Test/Deploy) are faster for common operations.
EOF
}

clear
echo "Welcome to StellarIDE Terminal"
echo "Project workspace: $(pwd)"
echo "Type 'help' for available commands"
echo ""
"#;
    tokio::fs::write(workspace.join(".bashrc"), bashrc).await?;
    Ok(())
}

pub fn is_input_blocked(data: &[u8]) -> bool {
    let text = String::from_utf8_lossy(data).to_lowercase();
    const BLOCKED: &[&str] = &[
        "rm -rf /",
        "rm -rf /*",
        "sudo ",
        "sudo\t",
        ":(){ :|:& };:",
        "chmod 777 /",
        "mkfs.",
        "dd if=",
    ];
    BLOCKED.iter().any(|pat| text.contains(pat))
}

fn build_shell_command(config: &Config, workspace: &Path) -> CommandBuilder {
    if config
        .soroban_execution_mode
        .eq_ignore_ascii_case("local")
    {
        let mut cmd = CommandBuilder::new("bash");
        cmd.arg("--login");
        cmd.cwd(workspace);
        cmd.env("TERM", "xterm-256color");
        cmd.env(
            "PATH",
            "/usr/local/cargo/bin:/usr/local/bin:/usr/bin:/bin",
        );
        cmd.env("HOME", workspace);
        cmd
    } else {
        let mount = format!("{}:/workspace", workspace.display());
        let mut cmd = CommandBuilder::new("docker");
        cmd.arg("run");
        cmd.arg("-i");
        cmd.arg("--rm");
        cmd.arg("-v");
        cmd.arg(mount);
        cmd.arg("-w");
        cmd.arg("/workspace");
        cmd.arg("-e");
        cmd.arg("TERM=xterm-256color");
        cmd.arg("-e");
        cmd.arg("HOME=/workspace");
        cmd.arg(&config.soroban_docker_image);
        cmd.arg("bash");
        cmd.arg("--login");
        cmd
    }
}

pub struct PtySession {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    resize: Arc<Mutex<Box<dyn portable_pty::MasterPty + Send>>>,
    _child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
}

pub fn spawn_pty_session(
    config: &Config,
    workspace: &Path,
    cols: u16,
    rows: u16,
) -> anyhow::Result<(PtySession, mpsc::UnboundedReceiver<Vec<u8>>)> {
    let pty_system = NativePtySystem::default();
    let pair = pty_system.openpty(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    })?;

    let cmd = build_shell_command(config, workspace);
    let child = pair.slave.spawn_command(cmd)?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader()?;
    let writer = pair.master.take_writer()?;
    let master = pair.master;

    let (tx, rx) = mpsc::unbounded_channel();

    std::thread::spawn(move || {
        let mut buf = [0u8; READ_BUF];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    if tx.send(buf[..n].to_vec()).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    Ok((
        PtySession {
            writer: Arc::new(Mutex::new(writer)),
            resize: Arc::new(Mutex::new(master)),
            _child: Arc::new(Mutex::new(child)),
        },
        rx,
    ))
}

pub async fn run_session(
    state: AppState,
    project_id: Uuid,
    user_id: Uuid,
    user_name: String,
    session_id: String,
    mut ws_tx: mpsc::UnboundedSender<axum::extract::ws::Message>,
    mut ws_rx: mpsc::UnboundedReceiver<axum::extract::ws::Message>,
    files: Vec<ProjectFile>,
    require_cargo: bool,
    cols: u16,
    rows: u16,
) -> anyhow::Result<()> {
    let key = SessionKey {
        project_id,
        user_id,
        session_id: session_id.clone(),
    };

    if state.terminal.session_count_for_user(project_id, user_id) >= MAX_SESSIONS_PER_USER {
        return Err(anyhow!("Maximum terminal sessions reached ({MAX_SESSIONS_PER_USER})"));
    }

    let workspace = sync_terminal_workspace(
        project_id,
        &files,
        &state.config.soroban_sdk_version,
        require_cargo,
    )
    .await?;

    let (pty, mut pty_rx) = spawn_pty_session(&state.config, &workspace, cols, rows)?;
    let (kill_tx, mut kill_rx) = oneshot::channel();
    state.terminal.register(key.clone(), kill_tx);

    let mut share_enabled = false;
    let idle_state = state.clone();
    let idle_key = key.clone();
    let idle_task = tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(60)).await;
            let stale = if let Some(entry) = idle_state.terminal.sessions.get(&idle_key) {
                entry.last_activity.lock().await.elapsed() > IDLE_TIMEOUT
            } else {
                true
            };
            if stale {
                idle_state.terminal.remove(&idle_key).await;
                break;
            }
        }
    });

    loop {
        tokio::select! {
            _ = &mut kill_rx => break,
            chunk = pty_rx.recv() => {
                match chunk {
                    Some(bytes) => {
                        state.terminal.touch(&key).await;
                        if ws_tx.send(axum::extract::ws::Message::Binary(bytes.clone().into())).is_err() {
                            break;
                        }
                        if share_enabled {
                            use base64::{engine::general_purpose, Engine as _};
                            let msg = CollabMessage::TerminalOutput {
                                user_id,
                                user_name: user_name.clone(),
                                operation: "shell".into(),
                                data: general_purpose::STANDARD.encode(&bytes),
                            };
                            state.collab.broadcast_project(project_id, &msg);
                        }
                    }
                    None => break,
                }
            }
            msg = ws_rx.recv() => {
                match msg {
                    Some(axum::extract::ws::Message::Binary(data)) => {
                        state.terminal.touch(&key).await;
                        if is_input_blocked(&data) {
                            let warning = b"\r\n\x1b[31m[blocked] Command not allowed in StellarIDE sandbox.\x1b[0m\r\n";
                            let _ = ws_tx.send(axum::extract::ws::Message::Binary(warning.to_vec().into()));
                            continue;
                        }
                        let mut writer = pty.writer.lock().await;
                        if writer.write_all(&data).is_err() {
                            break;
                        }
                        let _ = writer.flush();
                    }
                    Some(axum::extract::ws::Message::Text(text)) => {
                        state.terminal.touch(&key).await;
                        if let Ok(control) = serde_json::from_str::<TerminalControlMessage>(&text) {
                            match control {
                                TerminalControlMessage::Resize { cols, rows } => {
                                    let master = pty.resize.lock().await;
                                    let _ = master.resize(PtySize {
                                        rows,
                                        cols,
                                        pixel_width: 0,
                                        pixel_height: 0,
                                    });
                                }
                                TerminalControlMessage::Share { enabled } => {
                                    share_enabled = enabled;
                                }
                            }
                        }
                    }
                    Some(axum::extract::ws::Message::Close(_)) | None => break,
                    Some(axum::extract::ws::Message::Ping(p)) => {
                        let _ = ws_tx.send(axum::extract::ws::Message::Pong(p));
                    }
                    _ => {}
                }
            }
        }
    }

    idle_task.abort();
    state.terminal.remove(&key).await;
    Ok(())
}

pub fn project_requires_cargo(project: &crate::models::project::Project) -> bool {
    project.github_owner.is_some()
        || project.github_repo.is_some()
        || project.github_subfolder.is_some()
}
