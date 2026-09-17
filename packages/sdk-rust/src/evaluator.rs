use dashmap::DashMap;
use regex::Regex;
use serde_json::{json, Value};
use sha2::{Sha256, Digest};
use std::collections::HashMap;
use std::sync::Arc;

pub struct PolicyEvaluator {
    call_history: Arc<DashMap<String, Vec<u64>>>,
    session_costs: Arc<DashMap<String, f64>>,
    circuit_breaker: crate::circuit_breaker::CircuitBreaker,
}

impl Default for PolicyEvaluator {
    fn default() -> Self {
        Self::new()
    }
}

impl PolicyEvaluator {
    pub fn new() -> Self {
        Self {
            call_history: Arc::new(DashMap::new()),
            session_costs: Arc::new(DashMap::new()),
            circuit_breaker: crate::circuit_breaker::CircuitBreaker::new(),
        }
    }

    pub fn evaluate(&self, request: &crate::types::ToolCallRequest, policy: &crate::types::GuardrailPolicy) -> crate::types::EvaluationResult {
        let timestamp = chrono::Utc::now().to_rfc3339();
        let session_key = request.session_id.as_deref()
            .or(request.agent_id.as_deref())
            .unwrap_or("default-session");

        if let Some(cb_config) = &policy.circuit_breaker {
            let cb_check = self.circuit_breaker.check(session_key, &request.tool_name, &request.params, cb_config);
            if cb_check.tripped {
                return crate::types::EvaluationResult {
                    allowed: false,
                    reason: cb_check.reason,
                    action_taken: crate::types::ActionTaken::CircuitTripped,
                    timestamp,
                    remediation: Some(crate::types::Remediation {
                        status: "BLOCKED".to_string(),
                        suggested_fix: Some("Agent in retry loop. Abort current tool sequence and ask human for clarification.".to_string()),
                        max_allowed_value: None,
                    }),
                };
            }
        }

        if policy.enable_injection_sanitizer.unwrap_or(true) {
            let payload_str = serde_json::to_string(&request.params).unwrap_or_default();
            let sanitize_res = crate::sanitizer::InjectionSanitizer::inspect(&payload_str);
            if sanitize_res.detected {
                return crate::types::EvaluationResult {
                    allowed: false,
                    reason: Some(format!("Security Threat Detected: {} ({}).", sanitize_res.r#type.unwrap_or_default(), sanitize_res.pattern_matched.unwrap_or_default())),
                    action_taken: crate::types::ActionTaken::Block,
                    timestamp,
                    remediation: Some(crate::types::Remediation {
                        status: "BLOCKED".to_string(),
                        suggested_fix: Some("Sanitize input payload to remove prompt overrides or hidden unicode characters.".to_string()),
                        max_allowed_value: None,
                    }),
                };
            }
        }

        if let Some(allowed) = &policy.allowed_tools {
            if !allowed.is_empty() && !allowed.contains(&request.tool_name) {
                return crate::types::EvaluationResult {
                    allowed: false,
                    reason: Some(format!("Tool '{}' is not in the allowed tools list.", request.tool_name)),
                    action_taken: crate::types::ActionTaken::Block,
                    timestamp,
                    remediation: Some(crate::types::Remediation {
                        status: "BLOCKED".to_string(),
                        suggested_fix: Some(format!("Tool '{}' is not authorized. Permitted tools: {}.", request.tool_name, allowed.join(", "))),
                        max_allowed_value: None,
                    }),
                };
            }
        }

        if let Some(forbidden) = &policy.forbidden_tools {
            if forbidden.contains(&request.tool_name) {
                return crate::types::EvaluationResult {
                    allowed: false,
                    reason: Some(format!("Tool '{}' is explicitly forbidden by policy.", request.tool_name)),
                    action_taken: crate::types::ActionTaken::Block,
                    timestamp,
                    remediation: Some(crate::types::Remediation {
                        status: "BLOCKED".to_string(),
                        suggested_fix: Some(format!("Tool '{}' is prohibited in production environment.", request.tool_name)),
                        max_allowed_value: None,
                    }),
                };
            }
        }

        if let Some(required) = &policy.required_fields {
            for field in required {
                if !request.params.contains_key(field) || request.params[field].is_null() {
                    return crate::types::EvaluationResult {
                        allowed: false,
                        reason: Some(format!("Missing required parameter field '{}'.", field)),
                        action_taken: crate::types::ActionTaken::Block,
                        timestamp,
                        remediation: Some(crate::types::Remediation {
                            status: "REQUIRES_REMEDIATION".to_string(),
                            suggested_fix: Some(format!("Provide required parameter '{}' before invoking tool '{}'.", field, request.tool_name)),
                            max_allowed_value: None,
                        }),
                    };
                }
            }
        }

        if let Some(rate_limit) = &policy.rate_limit {
            let now = chrono::Utc::now().timestamp_millis() as u64;
            let one_minute_ago = now.saturating_sub(60000);

            let mut timestamps = self.call_history.entry(session_key.to_string()).or_insert_with(Vec::new);
            timestamps.retain(|&t| t > one_minute_ago);

            if timestamps.len() >= rate_limit.max_calls_per_minute as usize {
                return crate::types::EvaluationResult {
                    allowed: false,
                    reason: Some(format!("Rate limit exceeded: Max {} calls/min allowed.", rate_limit.max_calls_per_minute)),
                    action_taken: crate::types::ActionTaken::Block,
                    timestamp,
                    remediation: Some(crate::types::Remediation {
                        status: "BLOCKED".to_string(),
                        suggested_fix: Some(format!("Wait 60 seconds before issuing further tool calls for session '{}'.", session_key)),
                        max_allowed_value: None,
                    }),
                };
            }

            timestamps.push(now);
        }

        if let Some(max_cost) = policy.max_cost_per_session {
            if let Some(estimated) = request.estimated_cost {
                let mut current_cost = self.session_costs.entry(session_key.to_string()).or_insert(0.0);
                let new_cost = *current_cost + estimated;

                if new_cost > max_cost {
                    return crate::types::EvaluationResult {
                        allowed: false,
                        reason: Some(format!("Session cost threshold exceeded (${:.4} > ${:.4} cap).", new_cost, max_cost)),
                        action_taken: crate::types::ActionTaken::Block,
                        timestamp,
                        remediation: Some(crate::types::Remediation {
                            status: "BLOCKED".to_string(),
                            suggested_fix: Some(format!("Budget limit reached (${:.2}). Request budget approval.", max_cost)),
                            max_allowed_value: None,
                        }),
                    };
                }
                *current_cost = new_cost;
            }
        }

        if let Some(max_params) = &policy.max_param_values {
            for (param_key, max_value) in max_params {
                if let Some(Value::Number(actual)) = request.params.get(param_key) {
                    if let Some(fv) = actual.as_f64() {
                        if fv > *max_value {
                            return crate::types::EvaluationResult {
                                allowed: false,
                                reason: Some(format!("Parameter '{}' value ({}) exceeds maximum allowed threshold ({}).", param_key, fv, max_value)),
                                action_taken: crate::types::ActionTaken::Block,
                                timestamp,
                                remediation: Some(crate::types::Remediation {
                                    status: "REQUIRES_REMEDIATION".to_string(),
                                    suggested_fix: Some(format!("Reduce '{}' parameter to <= {}.", param_key, max_value)),
                                    max_allowed_value: Some(*max_value),
                                }),
                            };
                        }
                    }
                }
            }
        }

        if let Some(patterns) = &policy.forbidden_patterns {
            let param_str = serde_json::to_string(&request.params).unwrap_or_default();
            for pattern_str in patterns {
                if Regex::new(&format!("(?i){}", pattern_str)).unwrap().is_match(&param_str) {
                    return crate::types::EvaluationResult {
                        allowed: false,
                        reason: Some(format!("Parameter payload matched forbidden pattern: '{}'.", pattern_str)),
                        action_taken: crate::types::ActionTaken::Block,
                        timestamp,
                        remediation: Some(crate::types::Remediation {
                            status: "BLOCKED".to_string(),
                            suggested_fix: Some(format!("Remove forbidden pattern '{}' from input payload.", pattern_str)),
                            max_allowed_value: None,
                        }),
                    };
                }
            }
        }

        if policy.require_approval.unwrap_or(false) {
            return crate::types::EvaluationResult {
                allowed: false,
                reason: Some(format!("Tool '{}' requires human authorization prior to execution.", request.tool_name)),
                action_taken: crate::types::ActionTaken::RequireApproval,
                timestamp,
                remediation: Some(crate::types::Remediation {
                    status: "BLOCKED".to_string(),
                    suggested_fix: Some("Request human authorization token.".to_string()),
                    max_allowed_value: None,
                }),
            };
        }

        crate::types::EvaluationResult {
            allowed: true,
            reason: None,
            action_taken: crate::types::ActionTaken::Allow,
            timestamp,
            remediation: None,
        }
    }
}