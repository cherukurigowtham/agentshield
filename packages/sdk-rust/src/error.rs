use thiserror::Error;

#[derive(Error, Debug)]
pub enum AgentShieldError {
    #[error("[AgentShield Blocked] {0}")]
    Blocked(String),
    #[error("[AgentShield Timeout] Execution timed out after {0}ms")]
    Timeout(u64),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
}