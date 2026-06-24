use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use regex::Regex;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    errors::{AppError, Result},
    handlers::projects::{ensure_editor_access, load_project_files},
    middleware::auth::AuthUser,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    #[serde(default)]
    pub case_sensitive: bool,
    #[serde(default)]
    pub whole_word: bool,
    #[serde(default)]
    pub regex: bool,
}

#[derive(Debug, Serialize)]
pub struct SearchMatch {
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

#[derive(Debug, Serialize)]
pub struct FileSearchResult {
    pub file_path: String,
    pub matches: Vec<SearchMatch>,
}

#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub results: Vec<FileSearchResult>,
    pub total_matches: usize,
}

pub async fn search_project(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<SearchResponse>> {
    ensure_editor_access(auth.id, project_id, &state).await?;
    let q = query.q.trim();
    if q.is_empty() {
        return Ok(Json(SearchResponse {
            results: vec![],
            total_matches: 0,
        }));
    }

    let files = load_project_files(project_id, &state).await?;
    let pattern = build_pattern(q, query.case_sensitive, query.whole_word, query.regex)?;
    let mut results = Vec::new();
    let mut total = 0usize;

    for file in files {
        if file.language == "wasm" || file.file_path.ends_with(".wasm") {
            continue;
        }
        let mut file_matches = Vec::new();
        for (idx, line) in file.content.lines().enumerate() {
            for mat in pattern.find_iter(line) {
                file_matches.push(SearchMatch {
                    line_number: idx + 1,
                    line_content: line.to_string(),
                    match_start: mat.start(),
                    match_end: mat.end(),
                });
                total += 1;
            }
        }
        if !file_matches.is_empty() {
            results.push(FileSearchResult {
                file_path: file.file_path.clone(),
                matches: file_matches,
            });
        }
    }

    Ok(Json(SearchResponse {
        results,
        total_matches: total,
    }))
}

fn build_pattern(
    query: &str,
    case_sensitive: bool,
    whole_word: bool,
    use_regex: bool,
) -> Result<Regex> {
    let body = if use_regex {
        query.to_string()
    } else {
        let escaped = regex::escape(query);
        if whole_word {
            format!(r"\b{escaped}\b")
        } else {
            escaped
        }
    };

    let flags = if case_sensitive { "" } else { "(?i)" };
    let pattern = format!("{flags}{body}");
    Regex::new(&pattern).map_err(|e| AppError::BadRequest(format!("Invalid search pattern: {e}")))
}
