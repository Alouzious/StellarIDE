use axum::{extract::{Path, State}, Extension, Json};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    errors::{AppError, Result},
    handlers::projects::{ensure_editor_access, load_project, load_project_files},
    middleware::auth::AuthUser,
    services::verification,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct VerifyContractRequest {
    pub contract_id: String,
    #[serde(default = "default_network")]
    pub network: String,
}

fn default_network() -> String {
    "testnet".into()
}

pub async fn verify_contract(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<VerifyContractRequest>,
) -> Result<Json<verification::ContractVerificationResult>> {
    ensure_editor_access(auth.id, project_id, &state).await?;
    let project = load_project(project_id, &state).await?;
    let files = load_project_files(project_id, &state).await?;

    let result = verification::verify_contract(
        &files,
        &project,
        &body.contract_id,
        &body.network,
        &state.config,
    )
    .await
    .map_err(|e| AppError::BadRequest(e.to_string()))?;

    Ok(Json(result))
}
