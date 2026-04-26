use axum::{extract::{Path, State}, Extension, Json};
use serde::{Deserialize, Serialize};

use uuid::Uuid;
use crate::{
    errors::{AppError, Result},
    middleware::auth::AuthUser,
    AppState,
};

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

// ── Handler ───────────────────────────────────────────────────────────────────

pub async fn chat(
    Extension(_auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Json(body): Json<ChatRequest>,
) -> Result<Json<ChatResponse>> {
    let api_key = state
        .config
        .groq_api_key
        .as_deref()
        .ok_or_else(|| AppError::ServiceUnavailable(
            "AI chat is not configured. Set GROQ_API_KEY to enable this feature.".into(),
        ))?;

    if body.messages.is_empty() {
        return Err(AppError::BadRequest("messages array must not be empty".into()));
    }

    // Build system prompt
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

    let http = reqwest::Client::new();
    let resp = http
        .post("https://api.groq.com/openai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|_| {
            AppError::ServiceUnavailable(
                "AI service is currently unavailable. Please try again in a moment.".into(),
            )
        })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();
        tracing::warn!("Groq API error {}: {}", status, body_text);
        return Err(AppError::ServiceUnavailable(
            "AI service returned an error. Please try again."
                .into(),
        ));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|_| {
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

// ── AI Fix Request ────────────────────────────────────────────────────────────
#[derive(Debug, Deserialize)]
pub struct AiCodeRequest {
    pub code: String,
    pub errors: String,
}

#[derive(Debug, Serialize)]
pub struct AiCodeResponse {
    pub result: String,
}

async fn call_groq(api_key: &str, model: &str, system: &str, user: &str) -> Result<String> {
    let payload = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user }
        ],
        "max_tokens": 2048,
        "temperature": 0.2
    });
    let http = reqwest::Client::new();
    let resp = http
        .post("https://api.groq.com/openai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|_| AppError::ServiceUnavailable("AI service unavailable".into()))?;

    if !resp.status().is_success() {
        return Err(AppError::ServiceUnavailable("AI service returned an error".into()));
    }
    let data: serde_json::Value = resp.json().await
        .map_err(|_| AppError::ServiceUnavailable("AI response parse error".into()))?;
    Ok(data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string())
}

pub async fn ai_fix(
    Extension(_auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(_project_id): Path<Uuid>,
    Json(body): Json<AiCodeRequest>,
) -> Result<Json<AiCodeResponse>> {
    let api_key = state.config.groq_api_key.as_deref()
        .ok_or_else(|| AppError::ServiceUnavailable("GROQ_API_KEY not configured".into()))?;

    let system = "You are a Soroban smart contract expert.         When given broken Rust/Soroban code and compiler errors, you return ONLY the fixed Rust code.         No explanation, no markdown fences, no preamble. Just the raw fixed code.";

    let user = format!(
        "COMPILER ERRORS:\n{}\n\nCURRENT CODE:\n{}",
        body.errors, body.code
    );

    let result = call_groq(api_key, &state.config.groq_model, system, &user).await?;
    Ok(Json(AiCodeResponse { result }))
}

pub async fn ai_explain(
    Extension(_auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(_project_id): Path<Uuid>,
    Json(body): Json<AiCodeRequest>,
) -> Result<Json<AiCodeResponse>> {
    let api_key = state.config.groq_api_key.as_deref()
        .ok_or_else(|| AppError::ServiceUnavailable("GROQ_API_KEY not configured".into()))?;

    let system = "You are a Soroban smart contract expert helping a developer learn.         Explain compiler errors in simple, clear terms.         Keep it to 2-4 sentences. No markdown, plain text only.";

    let user = format!(
        "COMPILER ERRORS:\n{}\n\nCODE:\n{}",
        body.errors, body.code
    );

    let result = call_groq(api_key, &state.config.groq_model, system, &user).await?;
    Ok(Json(AiCodeResponse { result }))
}
