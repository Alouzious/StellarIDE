use axum::{Extension, Json};
use serde_json::Value;

use crate::{
    errors::Result,
    middleware::auth::AuthUser,
    services::templates,
};

pub async fn list_templates(Extension(_auth): Extension<AuthUser>) -> Result<Json<Value>> {
    Ok(Json(serde_json::json!(templates::list_templates())))
}
