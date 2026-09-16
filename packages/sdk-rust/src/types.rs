use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuardrailPolicy {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allowed_tools: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub forbidden_tools: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_param_values: Option<HashMap<String, f64>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub forbidden_patterns: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required_fields: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rate_limit: Option<RateLimitConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_cost_per_session: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub circuit_breaker: Option<CircuitBreakerConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_injection_sanitizer: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub require_approval: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webhook_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    pub max_calls_per_minute: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitBreakerConfig {
    #[serde(default = "default_max_repeated_calls")]
    pub max_repeated_calls: u32,
    #[serde(default = "default_time_window_ms")]
    pub time_window_ms: u64,
}

fn default_max_repeated_calls() -> u32 { 4 }
fn default_time_window_ms() -> u64 { 10000 }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCallRequest {
    pub tool_name: String,
    pub params: HashMap<String, serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_cost: Option<f64>,
}

impl ToolCallRequest {
    pub fn new(tool_name: impl Into<String>, params: HashMap<String, serde_json::Value>) -> Self {
        Self {
            tool_name: tool_name.into(),
            params,
            agent_id: None,
            session_id: None,
            estimated_cost: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationResult {
    pub allowed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    pub action_taken: ActionTaken,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remediation: Option<Remediation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ActionTaken {
    Allow,
    Block,
    RequireApproval,
    CircuitTripped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Remediation {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggested_fix: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_allowed_value: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct AgentShieldConfig {
    pub api_key: Option<String>,
    pub environment: Option<String>,
    pub telemetry_url: Option<String>,
    pub webhook_url: Option<String>,
    pub on_violation: Option<Box<dyn Fn(&EvaluationResult, &ToolCallRequest) + Send + Sync>>,
}

impl Default for AgentShieldConfig {
    fn default() -> Self {
        Self {
            api_key: None,
            environment: None,
            telemetry_url: None,
            webhook_url: None,
            on_violation: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAIToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub type_field: String,
    pub function: OpenAIFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIFunction {
    pub name: String,
    pub arguments: String,
}