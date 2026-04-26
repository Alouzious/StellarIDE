use anyhow::Context;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expiry_hours: i64,
    pub port: u16,
    // OAuth — optional; OAuth routes are disabled when these are absent
    pub github_client_id: Option<String>,
    pub github_client_secret: Option<String>,
    pub google_client_id: Option<String>,
    pub google_client_secret: Option<String>,
    /// Base URL of the frontend, used to build OAuth redirect URIs
    pub frontend_url: String,
    // AI — optional; chat endpoint returns a service-unavailable response when absent
    pub groq_api_key: Option<String>,
    pub groq_model: String,
    pub soroban_execution_mode: String,
    pub soroban_docker_image: String,
    pub soroban_timeout_seconds: u64,
    pub soroban_sdk_version: String,
    pub soroban_network: String,
    pub soroban_rpc_url: String,
    pub soroban_cli_path: String,
    pub soroban_deploy_secret_key: Option<String>,
    pub soroban_audit_command: Option<String>,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?,
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "change-me-in-production-minimum-32-chars!!".into()),
            jwt_expiry_hours: std::env::var("JWT_EXPIRY_HOURS")
                .unwrap_or_else(|_| "24".into())
                .parse()
                .unwrap_or(24),
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "8080".into())
                .parse()
                .unwrap_or(8080),
            github_client_id: std::env::var("GITHUB_CLIENT_ID").ok(),
            github_client_secret: std::env::var("GITHUB_CLIENT_SECRET").ok(),
            google_client_id: std::env::var("GOOGLE_CLIENT_ID").ok(),
            google_client_secret: std::env::var("GOOGLE_CLIENT_SECRET").ok(),
            frontend_url: std::env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:5173".into()),
            groq_api_key: std::env::var("GROQ_API_KEY").ok(),
            groq_model: std::env::var("GROQ_MODEL")
                .unwrap_or_else(|_| "llama-3.1-8b-instant".into()),
            soroban_execution_mode: std::env::var("SOROBAN_EXECUTION_MODE")
                .unwrap_or_else(|_| "docker".into()),
            soroban_docker_image: std::env::var("SOROBAN_DOCKER_IMAGE")
                .unwrap_or_else(|_| "stellaride/soroban-sandbox:latest".into()),
            soroban_timeout_seconds: std::env::var("SOROBAN_TIMEOUT_SECONDS")
                .unwrap_or_else(|_| "180".into())
                .parse()
                .unwrap_or(180),
            soroban_sdk_version: std::env::var("SOROBAN_SDK_VERSION")
                .unwrap_or_else(|_| "22.0.5".into()),
            soroban_network: std::env::var("SOROBAN_NETWORK").unwrap_or_else(|_| "testnet".into()),
            soroban_rpc_url: std::env::var("SOROBAN_RPC_URL")
                .unwrap_or_else(|_| "https://soroban-testnet.stellar.org".into()),
            soroban_cli_path: std::env::var("SOROBAN_CLI_PATH")
                .unwrap_or_else(|_| "soroban".into()),
            soroban_deploy_secret_key: std::env::var("SOROBAN_DEPLOY_SECRET_KEY").ok(),
            soroban_audit_command: std::env::var("SOROBAN_AUDIT_COMMAND")
                .ok()
                .or_else(|| Some("cargo scout-audit".into())),
        })
    }
}
