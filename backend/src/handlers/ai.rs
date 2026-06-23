use axum::{extract::{Path, State}, Extension, Json};
use serde::{Deserialize, Serialize};

use uuid::Uuid;
use crate::{
    errors::{AppError, Result},
    handlers::collab::{ensure_project_editor, ensure_project_member},
    middleware::auth::AuthUser,
    AppState,
};

const SOROBAN_EXPERT_SYSTEM: &str = "You are an expert Soroban smart contract auditor and developer. \
You have deep knowledge of the Stellar network, Soroban SDK, Rust programming, and smart contract security. \
You understand common Soroban vulnerabilities including missing require_auth(), integer overflow, improper storage usage, \
and reentrancy patterns. When fixing code, always explain WHY the fix is needed. When explaining code, be thorough but clear.";

// ── Request / Response types ──────────────────────────────────────────────────

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub messages: Vec<ChatMessage>,
}

#[derive(Debug, Serialize)]
pub struct ChatResponse {
    pub message: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AiFileSnippet {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AiAuditFinding {
    pub severity: String,
    pub title: String,
    pub description: String,
    pub file: String,
    pub line_start: u32,
    pub recommendation: String,
}

#[derive(Debug, Deserialize)]
pub struct AiProjectRequest {
    pub active_file: String,
    pub active_content: String,
    pub files: Vec<AiFileSnippet>,
    pub terminal_output: String,
    #[serde(default)]
    pub errors: String,
    #[serde(default)]
    pub audit_findings: Vec<AiAuditFinding>,
    #[serde(default = "default_network")]
    pub network: String,
    #[serde(default = "default_sdk_version")]
    pub sdk_version: String,
}

fn default_network() -> String {
    "testnet".into()
}

fn default_sdk_version() -> String {
    "22.0.11".into()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiFileFix {
    pub file_path: String,
    pub original: String,
    pub fixed: String,
    pub reason: String,
}

#[derive(Debug, Serialize)]
pub struct AiFixResponse {
    pub confidence: String,
    pub summary: String,
    pub fixes: Vec<AiFileFix>,
}

#[derive(Debug, Serialize)]
pub struct AiExplainResponse {
    pub markdown: String,
    pub file_path: String,
}

fn messages_request_code_edit(messages: &[ChatMessage]) -> bool {
    const EDIT_HINTS: &[&str] = &[
        "fix this",
        "fix the",
        "rewrite",
        "change the code",
        "modify the code",
        "update the code",
        "apply this fix",
        "generate code",
        "write code",
        "implement ",
    ];
    messages.iter().any(|m| {
        if m.role != "user" {
            return false;
        }
        let lower = m.content.to_lowercase();
        EDIT_HINTS.iter().any(|hint| lower.contains(hint))
    })
}

fn build_context_block(body: &AiProjectRequest) -> String {
    const MAX_FILE_CHARS: usize = 10_000;
    const MAX_TERMINAL_CHARS: usize = 5_000;
    const MAX_ERRORS_CHARS: usize = 3_000;
    const MAX_ACTIVE_CHARS: usize = 12_000;
    const MAX_FILES: usize = 6;
    const MAX_AUDIT_FINDINGS: usize = 12;

    fn truncate_tail(s: &str, max: usize) -> String {
        if s.len() <= max {
            return s.to_string();
        }
        format!("...(truncated {} chars)\n{}", s.len() - max, &s[s.len() - max..])
    }

    let active_content = truncate_tail(&body.active_content, MAX_ACTIVE_CHARS);

    let mut sections = vec![
        format!("NETWORK: {}", body.network),
        format!("SOROBAN SDK VERSION: {}", body.sdk_version),
        format!("ACTIVE FILE: {}", body.active_file),
        format!(
            "ACTIVE FILE CONTENT:\n```rust\n{}\n```",
            active_content
        ),
    ];

    if !body.files.is_empty() {
        let mut prioritized: Vec<_> = body.files.iter().collect();
        prioritized.sort_by_key(|f| {
            if f.path == body.active_file {
                0
            } else if f.path.ends_with("Cargo.toml") {
                1
            } else {
                2
            }
        });

        let mut files_block = String::from("ALL PROJECT FILES:\n");
        for f in prioritized.into_iter().take(MAX_FILES) {
            let content = truncate_tail(&f.content, MAX_FILE_CHARS);
            files_block.push_str(&format!("\n--- {} ---\n{}\n", f.path, content));
        }
        if body.files.len() > MAX_FILES {
            files_block.push_str(&format!(
                "\n... {} additional file(s) omitted for size limits\n",
                body.files.len() - MAX_FILES
            ));
        }
        sections.push(files_block);
    }

    if !body.terminal_output.trim().is_empty() {
        sections.push(format!(
            "TERMINAL OUTPUT:\n{}",
            truncate_tail(&body.terminal_output, MAX_TERMINAL_CHARS)
        ));
    }

    if !body.errors.trim().is_empty() {
        sections.push(format!(
            "ERRORS / WARNINGS:\n{}",
            truncate_tail(&body.errors, MAX_ERRORS_CHARS)
        ));
    }

    if !body.audit_findings.is_empty() {
        let mut audit = String::from("SCOUT AUDIT FINDINGS:\n");
        for f in body.audit_findings.iter().take(MAX_AUDIT_FINDINGS) {
            audit.push_str(&format!(
                "- [{}] {} ({}:{}): {}\n  Recommendation: {}\n",
                f.severity, f.title, f.file, f.line_start, f.description, f.recommendation
            ));
        }
        if body.audit_findings.len() > MAX_AUDIT_FINDINGS {
            audit.push_str(&format!(
                "... {} more finding(s) omitted\n",
                body.audit_findings.len() - MAX_AUDIT_FINDINGS
            ));
        }
        sections.push(audit);
    }

    sections.join("\n\n")
}

fn groq_error_message(status: reqwest::StatusCode, body: &str) -> String {
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(body) {
        if let Some(msg) = v["error"]["message"].as_str() {
            let lower = msg.to_lowercase();
            if lower.contains("rate limit") || lower.contains("rate_limit") {
                return "AI rate limit reached. Wait a few seconds and try again.".into();
            }
            if lower.contains("token") || lower.contains("context") || lower.contains("too large") {
                return "Request too large for the AI model. Clear the terminal and try again.".into();
            }
            if lower.contains("invalid api key") || lower.contains("invalid_api_key") {
                return "Invalid Groq API key. Set GROQ_API_KEY on the server.".into();
            }
            return msg.to_string();
        }
    }

    match status.as_u16() {
        401 | 403 => "Invalid Groq API key. Set GROQ_API_KEY on the server.".into(),
        429 => "AI rate limit reached. Wait a few seconds and try again.".into(),
        413 => "Request too large. Clear the terminal and try again.".into(),
        _ => format!(
            "AI service error (HTTP {}). Please try again.",
            status.as_u16()
        ),
    }
}

fn strip_code_fences(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.starts_with("```") {
        let without_first = trimmed.trim_start_matches('`');
        let inner = without_first
            .trim_start_matches(|c: char| c.is_alphabetic() || c == '\n')
            .trim();
        if let Some(end) = inner.rfind("```") {
            return inner[..end].trim().to_string();
        }
        return inner.to_string();
    }
    trimmed.to_string()
}

fn extract_json_value(raw: &str) -> Option<serde_json::Value> {
    let cleaned = strip_code_fences(raw);
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&cleaned) {
        return Some(v);
    }
    if let Some(start) = cleaned.find('{') {
        if let Some(end) = cleaned.rfind('}') {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&cleaned[start..=end]) {
                return Some(v);
            }
        }
    }
    None
}

async fn call_groq(
    api_key: &str,
    model: &str,
    system: &str,
    user: &str,
    max_tokens: u32,
    temperature: f32,
) -> Result<String> {
    let payload = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user }
        ],
        "max_tokens": max_tokens,
        "temperature": temperature
    });
    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let resp = http
        .post("https://api.groq.com/openai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            tracing::warn!("Groq request failed: {}", e);
            if e.is_timeout() {
                AppError::ServiceUnavailable(
                    "AI request timed out. Try again or clear the terminal to reduce context size.".into(),
                )
            } else {
                AppError::ServiceUnavailable(
                    "AI service is unreachable. Check your network and try again.".into(),
                )
            }
        })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();
        tracing::warn!("Groq API error {}: {}", status, body_text);
        return Err(AppError::ServiceUnavailable(groq_error_message(status, &body_text)));
    }
    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|_| AppError::ServiceUnavailable("AI response parse error".into()))?;
    Ok(data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string())
}

fn parse_fix_response(raw: &str, body: &AiProjectRequest) -> AiFixResponse {
    if let Some(value) = extract_json_value(raw) {
        let confidence = value
            .get("confidence")
            .and_then(|v| v.as_str())
            .unwrap_or("suggested")
            .to_string();
        let summary = value
            .get("summary")
            .and_then(|v| v.as_str())
            .unwrap_or("AI suggested fixes for your contract.")
            .to_string();
        let fixes = value
            .get("fixes")
            .and_then(|v| v.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| {
                        Some(AiFileFix {
                            file_path: item.get("file_path")?.as_str()?.to_string(),
                            original: item.get("original")?.as_str()?.to_string(),
                            fixed: item.get("fixed")?.as_str()?.to_string(),
                            reason: item
                                .get("reason")
                                .and_then(|v| v.as_str())
                                .unwrap_or("Security or correctness improvement")
                                .to_string(),
                        })
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        if !fixes.is_empty() {
            return AiFixResponse {
                confidence,
                summary,
                fixes,
            };
        }
    }

    let fixed = strip_code_fences(raw);
    AiFixResponse {
        confidence: "suggested".into(),
        summary: "AI generated a fix for the active file. Review carefully before applying.".into(),
        fixes: vec![AiFileFix {
            file_path: body.active_file.clone(),
            original: body.active_content.clone(),
            fixed: fixed.clone(),
            reason: "Address compiler errors and/or audit findings in the active file.".into(),
        }],
    }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

pub async fn chat(
    Extension(_auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Json(body): Json<ChatRequest>,
) -> Result<Json<ChatResponse>> {
    let api_key = state
        .config
        .groq_api_key
        .as_deref()
        .ok_or_else(|| {
            AppError::ServiceUnavailable(
                "AI chat is not configured. Set GROQ_API_KEY to enable this feature.".into(),
            )
        })?;

    if body.messages.is_empty() {
        return Err(AppError::BadRequest("messages array must not be empty".into()));
    }

    let mut messages = vec![ChatMessage {
        role: "system".into(),
        content: "You are StellarAI, an expert assistant for the StellarIDE platform. \
                  You help developers write, debug, and understand Soroban smart contracts on the Stellar network. \
                  Be concise, helpful, and code-focused. When showing code, use Rust syntax for Soroban contracts."
            .into(),
    }];
    messages.extend(body.messages);

    let payload = serde_json::json!({
        "model": state.config.groq_model.clone(),
        "messages": messages,
        "max_tokens": 1024,
        "temperature": 0.7
    });

    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    let resp = http
        .post("https://api.groq.com/openai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            tracing::warn!("Groq chat request failed: {}", e);
            AppError::ServiceUnavailable(
                "AI service is currently unavailable. Please try again in a moment.".into(),
            )
        })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();
        tracing::warn!("Groq API error {}: {}", status, body_text);
        return Err(AppError::ServiceUnavailable(groq_error_message(status, &body_text)));
    }

    let data: serde_json::Value = resp.json().await.map_err(|_| {
        AppError::ServiceUnavailable(
            "AI service returned an unexpected response. Please try again.".into(),
        )
    })?;

    let content = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("I could not generate a response. Please try again.")
        .to_string();

    Ok(Json(ChatResponse { message: content }))
}

pub async fn project_chat(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<ChatRequest>,
) -> Result<Json<ChatResponse>> {
    let role = ensure_project_member(&state, project_id, auth.id).await?;
    if role == "viewer" && messages_request_code_edit(&body.messages) {
        return Err(AppError::Forbidden);
    }
    chat(Extension(auth), State(state), Json(body)).await
}

pub async fn ai_fix(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<AiProjectRequest>,
) -> Result<Json<AiFixResponse>> {
    ensure_project_editor(&state, project_id, auth.id).await?;

    let api_key = state
        .config
        .groq_api_key
        .as_deref()
        .ok_or_else(|| {
            AppError::ServiceUnavailable(
                "AI Fix is not configured. Set GROQ_API_KEY on the server.".into(),
            )
        })?;

    let system = format!(
        "{SOROBAN_EXPERT_SYSTEM}\n\n\
         You are fixing Soroban smart contract code. Respond ONLY with valid JSON (no markdown fences) in this shape:\n\
         {{\n\
           \"confidence\": \"high\" or \"suggested\",\n\
           \"summary\": \"brief explanation of what you fixed and why\",\n\
           \"fixes\": [\n\
             {{\n\
               \"file_path\": \"path/to/file.rs\",\n\
               \"original\": \"exact original snippet or full file content\",\n\
               \"fixed\": \"exact fixed snippet or full file content\",\n\
               \"reason\": \"why this change is needed\"\n\
             }}\n\
           ]\n\
         }}\n\
         Rules:\n\
         - Include one entry per file that needs changes.\n\
         - For missing require_auth(), add it correctly at the function start.\n\
         - For arithmetic overflow, use checked math or Soroban safe patterns.\n\
         - For wrong storage types, use the correct Soroban storage API.\n\
         - Address Scout audit findings by severity (Critical/High first).\n\
         - Use confidence \"high\" only when the fix is straightforward and low-risk.\n\
         - Return complete fixed file content in \"fixed\" when replacing a whole file."
    );

    let user = format!(
        "Analyze the project context and propose fixes for errors and/or audit findings.\n\n{}",
        build_context_block(&body)
    );

    let raw = match call_groq(
        api_key,
        &state.config.groq_model,
        &system,
        &user,
        2048,
        0.15,
    )
    .await
    {
        Ok(raw) => raw,
        Err(e) => {
            // Retry with a smaller payload (active file + errors only)
            let compact = AiProjectRequest {
                active_file: body.active_file.clone(),
                active_content: body.active_content.clone(),
                files: body
                    .files
                    .iter()
                    .filter(|f| {
                        f.path == body.active_file || f.path.ends_with("Cargo.toml")
                    })
                    .cloned()
                    .collect(),
                terminal_output: String::new(),
                errors: body.errors.clone(),
                audit_findings: body.audit_findings.iter().take(5).cloned().collect(),
                network: body.network.clone(),
                sdk_version: body.sdk_version.clone(),
            };
            let compact_user = format!(
                "Analyze and propose fixes for errors and/or audit findings.\n\n{}",
                build_context_block(&compact)
            );
            tracing::info!("AI fix retrying with compact context after: {:?}", e);
            call_groq(
                api_key,
                &state.config.groq_model,
                &system,
                &compact_user,
                2048,
                0.15,
            )
            .await?
        }
    };

    if raw.trim().is_empty() {
        return Err(AppError::ServiceUnavailable(
            "AI could not generate a fix. Please try again.".into(),
        ));
    }

    Ok(Json(parse_fix_response(&raw, &body)))
}

pub async fn ai_explain(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<AiProjectRequest>,
) -> Result<Json<AiExplainResponse>> {
    ensure_project_member(&state, project_id, auth.id).await?;

    let api_key = state
        .config
        .groq_api_key
        .as_deref()
        .ok_or_else(|| AppError::ServiceUnavailable("GROQ_API_KEY not configured".into()))?;

    let system = format!(
        "{SOROBAN_EXPERT_SYSTEM}\n\n\
         Explain the Soroban contract in clear Markdown with these sections (use ## headings):\n\
         ## Overview\n\
         ## Function Breakdown\n\
         ## Security Considerations\n\
         ## Potential Issues\n\
         ## Soroban SDK Usage\n\
         If there are compiler errors or terminal warnings, add:\n\
         ## Compiler Errors\n\
         Explain errors in context of the code. Be thorough but readable."
    );

    let user = format!(
        "Explain the active file `{}` and how it fits in the project.\n\n{}",
        body.active_file,
        build_context_block(&body)
    );

    let markdown = call_groq(
        api_key,
        &state.config.groq_model,
        &system,
        &user,
        4096,
        0.3,
    )
    .await?;

    if markdown.trim().is_empty() {
        return Err(AppError::ServiceUnavailable(
            "AI could not generate an explanation. Please try again.".into(),
        ));
    }

    Ok(Json(AiExplainResponse {
        markdown,
        file_path: body.active_file.clone(),
    }))
}
