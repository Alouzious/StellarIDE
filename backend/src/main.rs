mod config;
mod db;
mod errors;
mod handlers;
mod middleware;
mod models;
mod routes;
mod services;

use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub type AppState = Arc<AppStateInner>;

pub struct AppStateInner {
    pub db: sqlx::PgPool,
    pub config: config::Config,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env file if present
    let _ = dotenvy::dotenv();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "backend=debug,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cfg = config::Config::from_env()?;
    let pool = db::connect(&cfg.database_url).await?;
    db::migrate(&pool).await?;

    let state: AppState = Arc::new(AppStateInner {
        db: pool,
        config: cfg.clone(),
    });
    let app = routes::build_router(state);

    let addr = format!("0.0.0.0:{}", cfg.port);
    tracing::info!("StellarIDE backend listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
