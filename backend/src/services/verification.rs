use std::process::Stdio;

use anyhow::{anyhow, Context};
use base64::{engine::general_purpose, Engine as _};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tokio::{fs, process::Command};
use uuid::Uuid;

use crate::{
    config::Config,
    models::{project::Project, project_file::ProjectFile},
};

const MIN_CONTRACT_ID_LENGTH: usize = 20;

#[derive(Debug, Serialize)]
pub struct ContractVerificationResult {
    pub bytecode_match: bool,
    pub local_wasm_hash: String,
    pub chain_wasm_hash: String,
    pub contract_id: String,
    pub network: String,
    pub wasm_file: String,
    pub stellar_expert_url: String,
    pub stellar_lab_url: String,
    pub source_file_count: usize,
    pub github_linked: bool,
    pub github_repo: Option<String>,
    pub github_workflow_url: String,
    pub message: String,
}

pub async fn verify_contract(
    files: &[ProjectFile],
    project: &Project,
    contract_id: &str,
    network: &str,
    config: &Config,
) -> anyhow::Result<ContractVerificationResult> {
    let contract_id = contract_id.trim();
    if !contract_id.starts_with('C') || contract_id.len() <= MIN_CONTRACT_ID_LENGTH {
        return Err(anyhow!("Invalid contract ID"));
    }

    let network = normalize_network(network);
    let (wasm_path, local_wasm) = local_wasm_bytes(files)
        .ok_or_else(|| anyhow!("No compiled WASM found. Compile your contract first."))?;
    let local_hash = sha256_hex(&local_wasm);

    let chain_wasm = fetch_chain_wasm(contract_id, &network, config).await?;
    let chain_hash = sha256_hex(&chain_wasm);
    let bytecode_match = local_hash == chain_hash;

    let segment = if network == "mainnet" { "public" } else { "testnet" };
    let stellar_expert_url = format!(
        "https://stellar.expert/explorer/{segment}/contract/{contract_id}"
    );
    let stellar_lab_url = format!(
        "https://lab.stellar.org/contract/{contract_id}?network={}",
        if network == "mainnet" { "public" } else { "testnet" }
    );

    let github_repo = project
        .github_owner
        .as_ref()
        .zip(project.github_repo.as_ref())
        .map(|(owner, repo)| format!("{owner}/{repo}"));

    let source_file_count = files
        .iter()
        .filter(|f| {
            f.language != "wasm"
                && !f.file_path.ends_with(".wasm")
                && (f.file_path.ends_with(".rs") || f.file_path.ends_with(".toml"))
        })
        .count();

    let message = if bytecode_match {
        "Bytecode verified: your compiled WASM matches the contract deployed on Stellar. \
         View it on Stellar Expert to inspect the contract. For full source validation on \
         Stellar Expert, link GitHub and use the official soroban-build-workflow."
            .to_string()
    } else {
        "Bytecode mismatch: the WASM in this project does not match what is deployed on chain. \
         Recompile and redeploy, or verify you are checking the correct contract ID."
            .to_string()
    };

    Ok(ContractVerificationResult {
        bytecode_match,
        local_wasm_hash: local_hash,
        chain_wasm_hash: chain_hash,
        contract_id: contract_id.to_string(),
        network,
        wasm_file: wasm_path,
        stellar_expert_url,
        stellar_lab_url,
        github_linked: github_repo.is_some(),
        github_repo,
        github_workflow_url: "https://github.com/stellar-expert/soroban-build-workflow".into(),
        source_file_count,
        message,
    })
}

fn normalize_network(network: &str) -> String {
    if network.eq_ignore_ascii_case("mainnet") {
        "mainnet".into()
    } else {
        "testnet".into()
    }
}

fn local_wasm_bytes(files: &[ProjectFile]) -> Option<(String, Vec<u8>)> {
    let wasm_file = files
        .iter()
        .find(|f| f.file_path.ends_with(".wasm") || f.language == "wasm")?;

    let bytes = general_purpose::STANDARD
        .decode(wasm_file.content.trim())
        .unwrap_or_else(|_| wasm_file.content.as_bytes().to_vec());

    Some((wasm_file.file_path.clone(), bytes))
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    hex::encode(digest)
}

async fn fetch_chain_wasm(
    contract_id: &str,
    network: &str,
    config: &Config,
) -> anyhow::Result<Vec<u8>> {
    let tmp = std::env::temp_dir().join(format!("stellaride-verify-{}.wasm", Uuid::new_v4()));
    let rpc_url = rpc_url_for_network(network, config);
    let cli = config.soroban_cli_path.trim();
    let cli_bin = if cli.is_empty() || cli.eq_ignore_ascii_case("stellar") {
        "stellar"
    } else {
        cli
    };

    let output = Command::new(cli_bin)
        .args([
            "contract",
            "fetch",
            "--id",
            contract_id,
            "--network",
            network,
            "--rpc-url",
            &rpc_url,
            "--out-file",
            tmp.to_str().context("invalid temp path")?,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .context("Failed to run stellar contract fetch")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(anyhow!(
            "Could not fetch contract WASM from the network. {stderr} {stdout}"
        ));
    }

    fs::read(&tmp)
        .await
        .context("Failed to read fetched WASM")
        .map(|bytes| {
            let _ = std::fs::remove_file(&tmp);
            bytes
        })
}

fn rpc_url_for_network(network: &str, config: &Config) -> String {
    if network == "mainnet" {
        "https://soroban.stellar.org".into()
    } else {
        config.soroban_rpc_url.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_is_stable() {
        assert_eq!(
            sha256_hex(b"hello"),
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }
}
