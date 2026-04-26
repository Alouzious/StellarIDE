use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::{handlers, middleware::auth::require_auth, AppState};

pub fn build_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Public routes
    let public = Router::new()
        .route("/health", get(handlers::health::health))
        .route("/auth/register", post(handlers::auth::register))
        .route("/auth/login", post(handlers::auth::login))
        // OAuth login initiation
        .route("/auth/github", get(handlers::oauth::github_login))
        .route(
            "/auth/github/callback",
            get(handlers::oauth::github_callback),
        )
        .route("/auth/google", get(handlers::oauth::google_login))
        .route(
            "/auth/google/callback",
            get(handlers::oauth::google_callback),
        )
        // OAuth provider availability (so frontend can hide buttons if not configured)
        .route(
            "/auth/oauth/providers",
            get(handlers::oauth::oauth_providers),
        );

    // Protected routes (require JWT)
    let protected = Router::new()
        .route("/auth/me", get(handlers::auth::me))
        .route("/projects", get(handlers::projects::list_projects))
        .route("/projects", post(handlers::projects::create_project))
        .route("/projects/:id", get(handlers::projects::get_project))
        .route("/projects/:id", put(handlers::projects::update_project))
        .route("/projects/:id", delete(handlers::projects::delete_project))
        .route("/projects/:id/files", get(handlers::projects::list_files))
        .route("/projects/:id/files", post(handlers::projects::save_file))
        .route(
            "/projects/:id/compile",
            post(handlers::projects::compile_project),
        )
        .route("/projects/:id/test", post(handlers::projects::test_project))
        .route(
            "/projects/:id/deploy",
            post(handlers::projects::deploy_project),
        )
        .route(
            "/projects/:id/audit",
            post(handlers::projects::audit_project),
        )
        // AI chat assistant
        .route("/ai/chat", post(handlers::ai::chat))
        .route("/projects/:id/ai-fix", post(handlers::ai::ai_fix))
        .route("/projects/:id/ai-explain", post(handlers::ai::ai_explain))
        .layer(middleware::from_fn_with_state(state.clone(), require_auth));

    Router::new()
        .nest("/api/v1", public)
        .nest("/api/v1", protected)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
