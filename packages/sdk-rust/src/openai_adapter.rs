use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid_tool_calls: Vec<OpenAIToolCall>,
    pub blocked_tool_calls: Vec<BlockedToolCall>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockedToolCall {
    pub tool_call: OpenAIToolCall,
    pub reason: String,
}

pub struct OpenAIAdapter {
    shield: crate::agentshield::AgentShield,
}

impl OpenAIAdapter {
    pub fn new(shield: crate::agentshield::AgentShield) -> Self {
        Self { shield }
    }

    pub fn validate_tool_calls(&self, tool_calls: Vec<OpenAIToolCall>, policies: HashMap<String, crate::types::GuardrailPolicy>) -> ValidationResult {
        let mut valid = Vec::new();
        let mut blocked = Vec::new();

        for tool_call in tool_calls {
            let tool_name = tool_call.function.name.clone();
            let policy = policies.get(&tool_name)
                .cloned()
                .or_else(|| policies.get("*").cloned())
                .unwrap_or_default();

            let mut parsed_params = HashMap::new();
            if !tool_call.function.arguments.is_empty() {
                if let Ok(v) = serde_json::from_str::<Value>(&tool_call.function.arguments) {
                    if let Value::Object(map) = v {
                        parsed_params = map.into_iter().collect();
                    }
                } else {
                    parsed_params.insert("raw".to_string(), Value::String(tool_call.function.arguments.clone()));
                }
            }

            let request = crate::types::ToolCallRequest {
                tool_name: tool_name.clone(),
                params: parsed_params,
                ..Default::default()
            };

            let eval_result = self.shield.guard(request, policy);

            if eval_result.allowed {
                valid.push(tool_call);
            } else {
                blocked.push(BlockedToolCall {
                    tool_call,
                    reason: eval_result.reason.unwrap_or_else(|| "Blocked by policy".to_string()),
                });
            }
        }

        ValidationResult {
            valid_tool_calls: valid,
            blocked_tool_calls: blocked,
        }
    }
}