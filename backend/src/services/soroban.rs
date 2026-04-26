use std::{
    path::{Path, PathBuf},
    process::Stdio,
    time::Instant,
};

use anyhow::{anyhow, Context};
use serde::Serialize;
use tokio::{fs, process::Command, time::timeout};
use uuid::Uuid;

use base64::{engine::general_purpose, Engine as _};
use crate::{config::Config, models::project_file::ProjectFile};

const MIN_CONTRACT_ID_LENGTH: usize = 20;

#[derive(Debug, Serialize)]
pub struct SorobanCommandResponse {
    pub operation: &'static str,
    pub status: String,
    pub message: String,
    pub logs: Vec<String>,
    pub success: bool,
    pub duration_ms: u128,
    pub wasm_artifact: Option<String>,
    pub wasm_base64: Option<String>,
    pub wasm_saved: bool,
    pub contract_id: Option<String>,
}

#[derive(Debug)]
pub struct DeployRequest {
    pub wallet_address: String,
    pub network: Option<String>,
    pub secret_key: Option<String>,
}

pub async fn run_compile(
    project_id: Uuid,
    files: &[ProjectFile],
    config: &Config,
) -> anyhow::Result<SorobanCommandResponse> {
    let workspace = write_workspace(project_id, files, &config.soroban_sdk_version).await?;
    let start = Instant::now();
    let script = "rustup target add wasm32-unknown-unknown && cargo build --target wasm32-unknown-unknown --release";
    let result = execute_script(config, &workspace, script).await;

    match result {
        Ok(command) => {
            let wasm_artifact = find_wasm_artifact(&workspace).await;
            let wasm_base64 = if command.success {
                if let Some(ref p) = wasm_artifact {
                    fs::read(workspace.join(p)).await.ok()
                        .map(|b| general_purpose::STANDARD.encode(&b))
                } else { None }
            } else { None };
            cleanup_workspace(&workspace).await;
            let wasm_saved = wasm_base64.is_some();
            Ok(SorobanCommandResponse {
                operation: "compile",
                status: if command.success { "success" } else { "failed" }.into(),
                message: if command.success {
                    "Soroban contract compiled successfully".into()
                } else {
                    "Compile failed".into()
                },
                logs: command.logs,
                success: command.success,
                duration_ms: start.elapsed().as_millis(),
                wasm_artifact,
                wasm_base64,
                wasm_saved,
                contract_id: None,
            })
        }
        Err(err) => {
            cleanup_workspace(&workspace).await;
            Ok(SorobanCommandResponse {
                operation: "compile",
                status: "failed".into(),
                message: err.to_string(),
                logs: vec![format!("Compile error: {err}")],
                success: false,
                duration_ms: start.elapsed().as_millis(),
                wasm_artifact: None,
                wasm_base64: None,
                wasm_saved: false,
                contract_id: None,
            })
        }
    }
}

pub async fn run_tests(
    project_id: Uuid,
    files: &[ProjectFile],
    config: &Config,
) -> anyhow::Result<SorobanCommandResponse> {
    let workspace = write_workspace(project_id, files, &config.soroban_sdk_version).await?;
    let start = Instant::now();
    let result = execute_script(config, &workspace, "cargo test -- --nocapture").await;
    cleanup_workspace(&workspace).await;

    match result {
        Ok(command) => Ok(SorobanCommandResponse {
            operation: "test",
            status: if command.success { "success" } else { "failed" }.into(),
            message: if command.success {
                "All tests passed".into()
            } else {
                "Some tests failed".into()
            },
            logs: command.logs,
            success: command.success,
            duration_ms: start.elapsed().as_millis(),
            wasm_artifact: None,
            wasm_base64: None,
            wasm_saved: false,
            contract_id: None,
        }),
        Err(err) => Ok(SorobanCommandResponse {
            operation: "test",
            status: "failed".into(),
            message: err.to_string(),
            logs: vec![format!("Test error: {err}")],
            success: false,
            duration_ms: start.elapsed().as_millis(),
            wasm_artifact: None,
            wasm_base64: None,
            wasm_saved: false,
            contract_id: None,
        }),
    }
}

pub async fn run_deploy(
    project_id: Uuid,
    files: &[ProjectFile],
    config: &Config,
    request: DeployRequest,
) -> anyhow::Result<SorobanCommandResponse> {
    let workspace = write_workspace(project_id, files, &config.soroban_sdk_version).await?;
    let start = Instant::now();

    let network = request
        .network
        .unwrap_or_else(|| config.soroban_network.clone())
        .to_lowercase();

    let secret = match request.secret_key.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => s.to_string(),
        None => match config.soroban_deploy_secret_key.as_deref() {
            Some(s) => s.to_string(),
            None => {
                cleanup_workspace(&workspace).await;
                return Ok(SorobanCommandResponse {
                    operation: "deploy",
                    status: "failed".into(),
                    message: "No secret key provided. Generate a wallet in the Deploy panel.".into(),
                    logs: vec![
                        format!("Wallet: {}", request.wallet_address),
                        "Tip: Complete Steps 1 and 2 in the Deploy panel first.".into(),
                    ],
                    success: false,
                    duration_ms: start.elapsed().as_millis(),
                    wasm_artifact: None,
                    wasm_base64: None,
                    wasm_saved: false,
                    contract_id: None,
                });
            }
        }
    };

    let cli_bin = {
        let p = config.soroban_cli_path.trim();
        if p.eq_ignore_ascii_case("soroban") { "stellar".to_string() } else { p.to_string() }
    };
    let rpc = &config.soroban_rpc_url;
    let passphrase = network_passphrase(&network);
    let net_flag = if network.eq_ignore_ascii_case("mainnet") { "mainnet" } else { "testnet" };
    // Use a unique ephemeral key name so parallel deploys don't collide
    let key_name = format!("sid_{}", Uuid::new_v4().simple());
    let deploy_script = format!(
        r#"set -e
mkdir -p /root/.config/stellar/identity
printf 'secret_key = "%s"\n' {secret_escaped} > /root/.config/stellar/identity/{key_name}.toml
WASM_PATH=$(find target -name '*.wasm' 2>/dev/null | head -n 1)
if [ -z "$WASM_PATH" ]; then
  rustup target add wasm32-unknown-unknown
  cargo build --target wasm32-unknown-unknown --release
  WASM_PATH=$(find target/wasm32-unknown-unknown/release -maxdepth 1 -name '*.wasm' | head -n 1)
fi
if [ -z "$WASM_PATH" ]; then echo 'No WASM artifact found' >&2; exit 1; fi
{cli_bin} contract deploy --wasm "$WASM_PATH" --source {key_name} --global --network {net_flag} --network-passphrase "{passphrase}"
rm -f /root/.config/stellar/identity/{key_name}.toml"#,
        secret_escaped = shell_escape(&secret),
        key_name = key_name,
        cli_bin = cli_bin,
        net_flag = net_flag,
        passphrase = passphrase,
    );
    let result = execute_script(config, &workspace, &deploy_script).await;
    cleanup_workspace(&workspace).await;

    match result {
        Ok(command) => {
            let contract_id = command
                .logs
                .iter()
                .rev()
                .find_map(|line| parse_contract_id(line));
            Ok(SorobanCommandResponse {
                operation: "deploy",
                status: if command.success { "success" } else { "failed" }.into(),
                message: if command.success {
                    "Deployment finished".into()
                } else {
                    "Deployment failed".into()
                },
                logs: command.logs,
                success: command.success,
                duration_ms: start.elapsed().as_millis(),
                wasm_artifact: None,
                wasm_base64: None,
                wasm_saved: false,
                contract_id,
            })
        }
        Err(err) => Ok(SorobanCommandResponse {
            operation: "deploy",
            status: "failed".into(),
            message: err.to_string(),
            logs: vec![format!("Deploy error: {err}")],
            success: false,
            duration_ms: start.elapsed().as_millis(),
            wasm_artifact: None,
            wasm_base64: None,
            wasm_saved: false,
            contract_id: None,
        }),
    }
}

pub async fn run_audit(
    project_id: Uuid,
    files: &[ProjectFile],
    config: &Config,
) -> anyhow::Result<SorobanCommandResponse> {
    let workspace = write_workspace(project_id, files, &config.soroban_sdk_version).await?;
    let start = Instant::now();

    let mut logs = run_static_checks(files);
    let mut success = true;
    let mut status = "success".to_string();
    let mut message = "Basic audit checks completed".to_string();

    if let Some(command) = &config.soroban_audit_command {
        match execute_script(config, &workspace, command).await {
            Ok(result) => {
                success = success && result.success;
                if !result.success {
                    status = "failed".into();
                    message = "Audit command reported issues".into();
                }
                logs.extend(result.logs);
            }
            Err(err) => {
                success = false;
                status = "failed".into();
                message = "Audit command failed".into();
                logs.push(format!("Audit execution error: {err}"));
            }
        }
    } else {
        status = "scaffold".into();
        success = false;
        message = "Set SOROBAN_AUDIT_COMMAND to run Scout or custom audit tooling.".into();
        logs.push(
            "TODO: configure SOROBAN_AUDIT_COMMAND (example: scout-audit --json .) for full contract auditing."
                .into(),
        );
    }

    cleanup_workspace(&workspace).await;

    Ok(SorobanCommandResponse {
        operation: "audit",
        status,
        message,
        logs,
        success,
        duration_ms: start.elapsed().as_millis(),
        wasm_artifact: None,
        wasm_base64: None,
        wasm_saved: false,
        contract_id: None,
    })
}

struct CommandResult {
    success: bool,
    logs: Vec<String>,
}

async fn execute_script(
    config: &Config,
    workspace: &Path,
    script: &str,
) -> anyhow::Result<CommandResult> {
    let mut command = if config.soroban_execution_mode.eq_ignore_ascii_case("local") {
        let mut cmd = Command::new("sh");
        cmd.arg("-c").arg(script);
        cmd.current_dir(workspace);
        cmd.env("PATH", "/usr/local/cargo/bin:/usr/local/bin:/usr/bin:/bin");
        cmd
    } else {
        let mount = format!("{}:/workspace", workspace.display());
        let mut cmd = Command::new("docker");
        cmd.arg("run")
            .arg("--rm")
            .arg("-v")
            .arg(mount)
            .arg("-w")
            .arg("/workspace")
            .arg(&config.soroban_docker_image)
            .arg("sh")
            .arg("-c")  // no -l: preserve image ENV PATH (cargo/rustup in /usr/local/cargo/bin)
            .arg(script);
        cmd
    };

    command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let output = timeout(
        std::time::Duration::from_secs(config.soroban_timeout_seconds),
        command.output(),
    )
    .await
    .map_err(|_| {
        anyhow!(
            "Command timed out after {} seconds",
            config.soroban_timeout_seconds
        )
    })?
    .context("Failed to execute command")?;

    let mut logs = Vec::new();
    logs.extend(split_output(&output.stdout));
    logs.extend(split_output(&output.stderr));

    Ok(CommandResult {
        success: output.status.success(),
        logs,
    })
}

async fn write_workspace(
    project_id: Uuid,
    files: &[ProjectFile],
    soroban_sdk_version: &str,
) -> anyhow::Result<PathBuf> {
    let root = std::env::temp_dir()
        .join("stellaride")
        .join(project_id.to_string())
        .join(Uuid::new_v4().to_string());
    fs::create_dir_all(&root).await?;

    let mut has_cargo_toml = false;
    let mut has_lib = false;

    for file in files {
        let safe_path = sanitize_relative_path(&file.file_path)
            .with_context(|| format!("Invalid file path {}", file.file_path))?;
        if safe_path == Path::new("Cargo.toml") {
            has_cargo_toml = true;
        }
        if safe_path == Path::new("src/lib.rs") || safe_path == Path::new("lib.rs") {
            has_lib = true;
        }

        let destination = root.join(&safe_path);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).await?;
        }
        // Skip wasm binaries — not needed for compile/test, used directly by deploy
        if safe_path.extension().map_or(false, |e| e == "wasm") {
            continue;
        }
        fs::write(destination, &file.content).await?;
    }

    if !has_cargo_toml {
        fs::write(
            root.join("Cargo.toml"),
            default_cargo_toml(soroban_sdk_version),
        )
        .await?;
    }

    if !has_lib {
        fs::create_dir_all(root.join("src")).await?;
        fs::write(root.join("src/lib.rs"), default_contract_content()).await?;
    }

    Ok(root)
}

fn sanitize_relative_path(path: &str) -> anyhow::Result<PathBuf> {
    let candidate = Path::new(path);
    if candidate.is_absolute() {
        return Err(anyhow!("absolute paths are not allowed"));
    }
    let mut clean = PathBuf::new();
    for component in candidate.components() {
        match component {
            std::path::Component::Normal(part) => clean.push(part),
            std::path::Component::CurDir => {}
            _ => return Err(anyhow!("path traversal is not allowed")),
        }
    }
    if clean.as_os_str().is_empty() {
        return Err(anyhow!("file path cannot be empty"));
    }
    Ok(clean)
}

fn default_cargo_toml(soroban_sdk_version: &str) -> String {
    format!(
        r#"[package]
name = "stellaride_contract"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = "{soroban_sdk_version}"

[dev-dependencies]
soroban-sdk = {{ version = "{soroban_sdk_version}", features = ["testutils"] }}
"#
    )
}

fn default_contract_content() -> &'static str {
    r#"#![no_std]
use soroban_sdk::{contract, contractimpl, vec, Env, Symbol, symbol_short, Vec};

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }
}
"#
}

async fn find_wasm_artifact(workspace: &Path) -> Option<String> {
    let target = workspace.join("target/wasm32-unknown-unknown/release");
    let mut entries = fs::read_dir(target).await.ok()?;
    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if path.extension().is_some_and(|ext| ext == "wasm") {
            let relative = path.strip_prefix(workspace).ok()?;
            return Some(relative.display().to_string());
        }
    }
    None
}

fn split_output(bytes: &[u8]) -> Vec<String> {
    String::from_utf8_lossy(bytes)
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| line.to_string())
        .collect()
}

fn run_static_checks(files: &[ProjectFile]) -> Vec<String> {
    let mut logs = vec!["Running static audit checks...".into()];
    let mut unsafe_count = 0usize;
    let mut unwrap_count = 0usize;

    for file in files {
        if file.language != "rust" && !file.file_path.ends_with(".rs") {
            continue;
        }
        unsafe_count += file.content.matches("unsafe").count();
        unwrap_count += file.content.matches(".unwrap(").count();
    }

    logs.push(format!("unsafe keyword occurrences: {unsafe_count}"));
    logs.push(format!("unwrap() call occurrences: {unwrap_count}"));
    if unsafe_count > 0 || unwrap_count > 0 {
        logs.push("Warning: review unsafe/unwrap usage for production-grade contracts.".into());
    } else {
        logs.push("No obvious unsafe/unwrap patterns found in Rust source files.".into());
    }
    logs
}

fn network_passphrase(network: &str) -> &'static str {
    if network.eq_ignore_ascii_case("mainnet") {
        "Public Global Stellar Network ; September 2015"
    } else {
        "Test SDF Network ; September 2015"
    }
}

fn parse_contract_id(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if trimmed.starts_with("C") && trimmed.len() > MIN_CONTRACT_ID_LENGTH {
        return Some(trimmed.to_string());
    }
    trimmed
        .split_whitespace()
        .find(|token| token.starts_with('C') && token.len() > MIN_CONTRACT_ID_LENGTH)
        .map(|s| s.to_string())
}

fn shell_escape(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn contract_cli_command(configured_path: &str) -> String {
    let trimmed = configured_path.trim();
    if trimmed.eq_ignore_ascii_case("soroban") {
        [
            "if command -v soroban >/dev/null 2>&1; then soroban;",
            "elif command -v stellar >/dev/null 2>&1; then stellar contract;",
            "else echo 'Missing Soroban CLI. Configure SOROBAN_DOCKER_IMAGE with Soroban tooling or set SOROBAN_CLI_PATH.' >&2; exit 1;",
            "fi",
        ]
        .join(" ")
    } else {
        shell_escape(trimmed)
    }
}

async fn cleanup_workspace(workspace: &Path) {
    if let Err(err) = fs::remove_dir_all(workspace).await {
        tracing::debug!(
            "Failed to clean temp workspace {}: {}",
            workspace.display(),
            err
        );
    }
}

#[cfg(test)]
mod tests {
    use super::{contract_cli_command, sanitize_relative_path};

    #[test]
    fn allows_nested_relative_paths() {
        let clean = sanitize_relative_path("src/lib.rs").unwrap();
        assert_eq!(clean.to_string_lossy(), "src/lib.rs");
    }

    #[test]
    fn rejects_parent_directory_escape() {
        assert!(sanitize_relative_path("../secret").is_err());
    }

    #[test]
    fn default_cli_command_supports_soroban_and_stellar() {
        let command = contract_cli_command("soroban");
        assert!(command.contains("command -v soroban"));
        assert!(command.contains("command -v stellar"));
    }
}
