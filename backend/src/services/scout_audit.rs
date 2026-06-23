use std::path::Path;
use std::process::Stdio;
use std::sync::Arc;

use anyhow::{anyhow, Context};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::{
    io::{AsyncBufReadExt, AsyncReadExt, BufReader},
    process::Command,
    time::timeout,
};
use uuid::Uuid;

use crate::{config::Config, models::project_file::ProjectFile};

use super::soroban::{build_shell_command, write_workspace, LineSink, NO_CARGO_MSG};

pub const AUDIT_TIMEOUT_SECS: u64 = 60;

pub const SCOUT_PROGRESS_CATEGORIES: &[&str] = &[
    "access control issues",
    "arithmetic vulnerabilities",
    "unsafe unwrap/expect usage",
    "storage authorization",
    "DoS and unbounded operations",
    "panic and error handling",
    "contract WASM update protection",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditFinding {
    pub id: String,
    pub title: String,
    pub description: String,
    pub severity: String,
    pub category: String,
    pub file: String,
    pub line_start: u32,
    pub line_end: u32,
    pub code_snippet: String,
    pub recommendation: String,
}

#[derive(Debug, Serialize)]
pub struct AuditResult {
    pub operation: &'static str,
    pub status: String,
    pub message: String,
    pub logs: Vec<String>,
    pub success: bool,
    pub duration_ms: u128,
    pub findings: Vec<AuditFinding>,
    pub risk_level: String,
    pub findings_count: usize,
}

pub fn scout_command() -> &'static str {
    "cargo scout-audit --output-format json"
}

pub fn compute_risk_level(findings: &[AuditFinding]) -> String {
    if findings.is_empty() {
        return "CLEAN".into();
    }
    if findings.iter().any(|f| f.severity == "Critical" || f.severity == "High") {
        return "HIGH RISK".into();
    }
    if findings.iter().any(|f| f.severity == "Medium") {
        return "MEDIUM RISK".into();
    }
    "LOW RISK".into()
}

pub fn normalize_severity(raw: &str) -> String {
    match raw.trim().to_ascii_lowercase().as_str() {
        "critical" => "Critical".into(),
        "high" => "High".into(),
        "medium" => "Medium".into(),
        "low" | "minor" => "Low".into(),
        "enhancement" | "informational" | "info" => "Informational".into(),
        other if other.is_empty() => "Informational".into(),
        other => {
            let mut s = other.to_string();
            if let Some(first) = s.get_mut(0..1) {
                first.make_ascii_uppercase();
            }
            s
        }
    }
}

pub fn detector_category(detector_id: &str) -> String {
    let id = detector_id.to_ascii_lowercase();
    if id.contains("auth") || id.contains("storage") || id.contains("mapping") || id.contains("transfer") || id.contains("wasm") {
        "Access Control".into()
    } else if id.contains("overflow") || id.contains("divide") || id.contains("exponent") || id.contains("arithmetic") {
        "Arithmetic".into()
    } else if id.contains("reentrancy") {
        "Reentrancy".into()
    } else if id.contains("dos") || id.contains("unbounded") {
        "Denial of Service".into()
    } else if id.contains("unwrap") || id.contains("expect") || id.contains("panic") || id.contains("assert") {
        "Error Handling".into()
    } else if id.contains("unsafe") || id.contains("mem-forget") {
        "Unsafe Code".into()
    } else if id.contains("random") {
        "Randomness".into()
    } else if id.contains("logging") || id.contains("event") {
        "Logging & Events".into()
    } else if id.contains("version") {
        "Dependencies".into()
    } else {
        "Best Practices".into()
    }
}

pub fn parse_scout_json(raw: &str) -> anyhow::Result<Vec<AuditFinding>> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(vec![]);
    }

    let value: Value = serde_json::from_str(extract_json_payload(trimmed))
        .or_else(|_| serde_json::from_str(trimmed))
        .context("Failed to parse Scout JSON output")?;

    let items = collect_finding_values(&value);
    let mut findings = Vec::new();
    for (idx, item) in items.into_iter().enumerate() {
        if let Some(finding) = map_finding_value(&item, idx) {
            findings.push(finding);
        }
    }
    Ok(findings)
}

fn extract_json_payload(raw: &str) -> &str {
    if let Some(start) = raw.find('{') {
        if let Some(end) = raw.rfind('}') {
            return &raw[start..=end];
        }
    }
    if let Some(start) = raw.find('[') {
        if let Some(end) = raw.rfind(']') {
            return &raw[start..=end];
        }
    }
    raw
}

fn collect_finding_values(value: &Value) -> Vec<Value> {
    match value {
        Value::Array(items) => items.clone(),
        Value::Object(map) => {
            for key in ["findings", "results", "detections", "issues", "data"] {
                if let Some(Value::Array(items)) = map.get(key) {
                    return items.clone();
                }
            }
            if map.contains_key("severity") || map.contains_key("detector") || map.contains_key("detectorId") {
                return vec![value.clone()];
            }
            vec![]
        }
        _ => vec![],
    }
}

fn map_finding_value(item: &Value, idx: usize) -> Option<AuditFinding> {
    let detector_id = pick_str(item, &["detector", "detectorId", "detector_id", "id", "rule_id"])
        .unwrap_or_else(|| format!("finding-{idx}"));
    let title = pick_str(item, &["title", "name", "detector", "detectorId", "detector_id"])
        .unwrap_or_else(|| detector_id.clone());
    let description = pick_str(item, &["description", "message", "details", "detail"])
        .unwrap_or_else(|| title.clone());
    let severity = normalize_severity(
        &pick_str(item, &["severity", "level", "impact"]).unwrap_or_else(|| "Informational".into()),
    );
    let category = pick_str(item, &["category", "class", "type"])
        .unwrap_or_else(|| detector_category(&detector_id));

    let (file, line_start, line_end) = parse_location(item);
    let code_snippet = pick_str(item, &["code_snippet", "snippet", "code", "source"])
        .unwrap_or_default();
    let recommendation = pick_str(item, &["recommendation", "remediation", "fix", "help"])
        .unwrap_or_else(|| default_recommendation(&detector_id));

    Some(AuditFinding {
        id: format!("{detector_id}-{file}-{line_start}-{idx}"),
        title,
        description,
        severity,
        category,
        file,
        line_start,
        line_end,
        code_snippet,
        recommendation,
    })
}

fn parse_location(item: &Value) -> (String, u32, u32) {
    if let Some(loc) = item.get("location").or_else(|| item.get("span")) {
        let file = pick_str(loc, &["file", "file_name", "path", "filename"]).unwrap_or_else(|| "src/lib.rs".into());
        let start = pick_u32(loc, &["startLine", "start_line", "line", "line_start", "lineStart"]).unwrap_or(1);
        let end = pick_u32(loc, &["endLine", "end_line", "line_end", "lineEnd"]).unwrap_or(start);
        return (file, start, end);
    }

    let file = pick_str(item, &["file", "file_name", "path", "filename"]).unwrap_or_else(|| "src/lib.rs".into());
    let start = pick_u32(item, &["line", "line_start", "startLine", "start_line"]).unwrap_or(1);
    let end = pick_u32(item, &["line_end", "endLine", "end_line"]).unwrap_or(start);
    (file, start, end)
}

fn pick_str(value: &Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(v) = value.get(key).and_then(|v| v.as_str()) {
            if !v.trim().is_empty() {
                return Some(v.trim().to_string());
            }
        }
    }
    None
}

fn pick_u32(value: &Value, keys: &[&str]) -> Option<u32> {
    for key in keys {
        if let Some(v) = value.get(key) {
            if let Some(n) = v.as_u64() {
                return Some(n.max(1) as u32);
            }
            if let Some(s) = v.as_str() {
                if let Ok(n) = s.parse::<u32>() {
                    return Some(n.max(1));
                }
            }
        }
    }
    None
}

fn default_recommendation(detector_id: &str) -> String {
    let id = detector_id.to_ascii_lowercase();
    if id.contains("auth") || id.contains("storage") {
        "Review access control and add require_auth() or equivalent authorization checks.".into()
    } else if id.contains("unwrap") || id.contains("expect") {
        "Replace unwrap/expect with explicit error handling using Result or contract errors.".into()
    } else if id.contains("overflow") {
        "Use checked arithmetic or Soroban safe math helpers to prevent overflow/underflow.".into()
    } else {
        "Review this finding and apply the recommended secure coding pattern.".into()
    }
}

async fn execute_scout(
    config: &Config,
    workspace: &Path,
    on_line: Option<LineSink>,
) -> anyhow::Result<(i32, String, Vec<String>)> {
    let mut command = build_shell_command(config, workspace, scout_command());
    command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let mut scout_logs = Vec::new();
    let run = async {
        let mut child = command.spawn().context("Failed to spawn Scout audit")?;
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        if let Some(err) = stderr {
            let sink = on_line.clone();
            let log_buf = Arc::new(tokio::sync::Mutex::new(Vec::new()));
            let log_clone = log_buf.clone();
            let task = tokio::spawn(async move {
                let mut lines = BufReader::new(err).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    if line.is_empty() {
                        continue;
                    }
                    log_clone.lock().await.push(line.clone());
                    if let Some(ref sink) = sink {
                        sink(line);
                    }
                }
            });
            let _ = task.await;
            scout_logs = log_buf.lock().await.clone();
        }

        let mut stdout_buf = String::new();
        if let Some(out) = stdout {
            let mut reader = BufReader::new(out);
            reader.read_to_string(&mut stdout_buf).await?;
        }

        let status = child.wait().await.context("Failed to wait for Scout audit")?;
        Ok((status.code().unwrap_or(-1), stdout_buf, scout_logs))
    };

    timeout(
        std::time::Duration::from_secs(AUDIT_TIMEOUT_SECS.min(config.soroban_timeout_seconds.max(10))),
        run,
    )
    .await
    .map_err(|_| anyhow!("Scout audit timed out after {AUDIT_TIMEOUT_SECS} seconds"))?
}

fn emit_progress(on_line: &LineSink) {
    on_line("Running Scout detectors...".into());
    for category in SCOUT_PROGRESS_CATEGORIES {
        on_line(format!("Checking for {category}..."));
    }
}

pub async fn run_scout_audit(
    project_id: Uuid,
    files: &[ProjectFile],
    config: &Config,
    require_cargo_toml: bool,
    on_line: Option<LineSink>,
) -> anyhow::Result<AuditResult> {
    let start = std::time::Instant::now();
    let workspace = match write_workspace(project_id, files, &config.soroban_sdk_version, require_cargo_toml).await {
        Ok(w) => w,
        Err(err) if err.to_string().contains(NO_CARGO_MSG) => {
            return Ok(failed_audit(
                NO_CARGO_MSG,
                vec![NO_CARGO_MSG.into()],
                start.elapsed().as_millis(),
            ));
        }
        Err(err) => return Err(err),
    };

    if let Some(ref sink) = on_line {
        emit_progress(sink);
    }

    let scout_result = execute_scout(config, &workspace, on_line.clone()).await;
    super::soroban::cleanup_workspace(&workspace).await;

    let (findings, logs, success, message, status) = match scout_result {
        Ok((code, stdout, mut scout_logs)) => {
            let mut logs = vec!["Scout audit completed".into()];
            logs.append(&mut scout_logs);

            let findings = match parse_scout_json(&stdout) {
                Ok(f) => f,
                Err(err) => {
                    let msg = format!("Scout finished but output could not be parsed: {err}");
                    logs.push(msg.clone());
                    if let Some(ref sink) = on_line {
                        sink(msg.clone());
                    }
                    vec![]
                }
            };

            if let Some(ref sink) = on_line {
                sink(format!("Found {} issues", findings.len()));
                for finding in &findings {
                    if let Ok(json) = serde_json::to_string(finding) {
                        sink(format!("[FINDING] {json}"));
                    }
                }
            }

            let (success, message, status) = if findings.is_empty() && code == 0 {
                (
                    true,
                    "No vulnerabilities found".into(),
                    "success".into(),
                )
            } else if findings.is_empty() && code != 0 {
                (
                    false,
                    "Scout reported an error — see terminal output".into(),
                    "failed".into(),
                )
            } else {
                (
                    false,
                    format!("Scout found {} issue(s)", findings.len()),
                    "issues_found".into(),
                )
            };

            (findings, logs, success, message, status)
        }
        Err(err) => {
            let msg = err.to_string();
            let friendly = if msg.contains("timed out") {
                format!("Scout audit timed out after {AUDIT_TIMEOUT_SECS}s — try a smaller contract or increase timeout")
            } else if msg.contains("No such file") || msg.contains("not found") || msg.contains("scout-audit") {
                "Scout is not installed in the execution environment. Rebuild the sandbox Docker image with cargo-scout-audit.".into()
            } else {
                format!("Scout audit failed: {msg}")
            };
            if let Some(ref sink) = on_line {
                sink(friendly.clone());
            }
            (
                vec![],
                vec![friendly.clone()],
                false,
                friendly,
                "failed".into(),
            )
        }
    };

    Ok(AuditResult {
        operation: "audit",
        status,
        message,
        logs,
        success,
        duration_ms: start.elapsed().as_millis(),
        findings_count: findings.len(),
        risk_level: compute_risk_level(&findings),
        findings,
    })
}

fn failed_audit(message: &str, logs: Vec<String>, duration_ms: u128) -> AuditResult {
    AuditResult {
        operation: "audit",
        status: "failed".into(),
        message: message.into(),
        logs,
        success: false,
        duration_ms,
        findings: vec![],
        risk_level: "CLEAN".into(),
        findings_count: 0,
    }
}

pub fn audit_result_to_logs(result: &AuditResult) -> Vec<String> {
    let mut logs = result.logs.clone();
    if result.findings.is_empty() && result.success {
        logs.push("✓ No vulnerabilities found".into());
    }
    logs
}
