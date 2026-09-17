use reqwest::Client;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::timeout;

pub type BoxFuture<R> = Pin<Box<dyn Future<Output = R> + Send>>;

pub struct AgentShield {
    config: crate::types::AgentShieldConfig,
    evaluator: Arc<crate::evaluator::PolicyEvaluator>,
    http_client: Client,
}

impl AgentShield {
    pub fn new(config: crate::types::AgentShieldConfig) -> Self {
        let http_client = Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap_or_default();

        Self {
            config,
            evaluator: Arc::new(crate::evaluator::PolicyEvaluator::new()),
            http_client,
        }
    }

    pub fn guard(&self, request: crate::types::ToolCallRequest, policy: crate::types::GuardrailPolicy) -> crate::types::EvaluationResult {
        let result = self.evaluator.evaluate(&request, &policy);

        if !result.allowed {
            if let Some(cb) = &self.config.on_violation {
                cb(&result, &request);
            }

            let webhook_url = policy.webhook_url.as_deref().or(self.config.webhook_url.as_deref());
            if let Some(url) = webhook_url {
                let result_clone = result.clone();
                let request_clone = request.clone();
                let url = url.to_string();
                let client = self.http_client.clone();
                tokio::spawn(async move {
                    let _ = Self::dispatch_webhook(client, url, result_clone, request_clone).await;
                });
            }
        }

        if let Some(telemetry_url) = &self.config.telemetry_url {
            let result_clone = result.clone();
            let request_clone = request.clone();
            let url = telemetry_url.clone();
            let client = self.http_client.clone();
            tokio::spawn(async move {
                let _ = Self::send_telemetry(client, url, result_clone, request_clone).await;
            });
        }

        result
    }

    pub fn wrap_tool<F, Fut, T, R>(&self, tool_name: &str, tool_fn: F, policy: crate::types::GuardrailPolicy) -> impl Fn(T) -> BoxFuture<Result<R, crate::error::AgentShieldError>> + Clone
    where
        F: Fn(T) -> Fut + Clone + Send + Sync + 'static,
        Fut: Future<Output = Result<R, crate::error::AgentShieldError>> + Send + 'static,
        T: Send + 'static + serde::Serialize,
        R: Send + 'static,
    {
        let shield = self.clone();
        let tool_name = tool_name.to_string();
        move |input| {
            let shield = shield.clone();
            let tool_name = tool_name.clone();
            let policy = policy.clone();
            let tool_fn = tool_fn.clone();
            Box::pin(async move {
                let policy_for_guard = policy.clone();
                let request = crate::types::ToolCallRequest {
                    tool_name: tool_name.clone(),
                    params: serde_json::to_value(&input).unwrap_or_else(|_| json!({ "input": input })).as_object().unwrap().clone().into_iter().collect(),
                    ..Default::default()
                };

                let eval_result = shield.guard(request, policy_for_guard);
                if !eval_result.allowed {
                    return Err(crate::error::AgentShieldError::Blocked(eval_result.reason.unwrap_or_default()));
                }

                let result_fut = tool_fn(input);
                
                if let Some(timeout_ms) = policy.timeout_ms {
                    match timeout(Duration::from_millis(timeout_ms), result_fut).await {
                        Ok(inner_result) => inner_result,
                        Err(_) => Err(crate::error::AgentShieldError::Timeout(timeout_ms)),
                    }
                } else {
                    result_fut.await
                }
            })
        }
    }

    async fn dispatch_webhook(client: Client, url: String, result: crate::types::EvaluationResult, request: crate::types::ToolCallRequest) -> Result<(), reqwest::Error> {
        let payload = json!({
            "event": "AGENTSHIELD_VIOLATION_BLOCKED",
            "toolName": request.tool_name,
            "reason": result.reason,
            "timestamp": result.timestamp,
            "params": request.params
        });
        client.post(&url).json(&payload).send().await?;
        Ok(())
    }

    async fn send_telemetry(client: Client, url: String, result: crate::types::EvaluationResult, request: crate::types::ToolCallRequest) -> Result<(), reqwest::Error> {
        let payload = json!({
            "agentId": request.agent_id,
            "toolName": request.tool_name,
            "params": request.params,
            "actionTaken": result.action_taken,
            "reason": result.reason,
            "timestamp": result.timestamp
        });
        client.post(&url).json(&payload).send().await?;
        Ok(())
    }
}

impl Clone for AgentShield {
    fn clone(&self) -> Self {
        Self {
            config: crate::types::AgentShieldConfig {
                api_key: self.config.api_key.clone(),
                environment: self.config.environment.clone(),
                telemetry_url: self.config.telemetry_url.clone(),
                webhook_url: self.config.webhook_url.clone(),
                on_violation: self.config.on_violation.clone(),
            },
            evaluator: self.evaluator.clone(),
            http_client: self.http_client.clone(),
        }
    }
}

impl Default for AgentShield {
    fn default() -> Self {
        Self::new(crate::types::AgentShieldConfig::default())
    }
}