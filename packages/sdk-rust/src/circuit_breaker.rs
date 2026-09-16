use dashmap::DashMap;
use serde_json;
use sha2::{Sha256, Digest};
use std::sync::Arc;

#[derive(Debug, Clone)]
struct CallRecord {
    params_hash: String,
    timestamp: u64,
}

pub struct CircuitBreaker {
    call_tracker: Arc<DashMap<String, Vec<CallRecord>>>,
    tripped_breakers: Arc<DashMap<String, u64>>,
}

impl Default for CircuitBreaker {
    fn default() -> Self {
        Self::new()
    }
}

impl CircuitBreaker {
    pub fn new() -> Self {
        Self {
            call_tracker: Arc::new(DashMap::new()),
            tripped_breakers: Arc::new(DashMap::new()),
        }
    }

    pub fn check(&self, session_key: &str, tool_name: &str, params: &HashMap<String, serde_json::Value>, config: &crate::types::CircuitBreakerConfig) -> CircuitBreakerResult {
        let max_calls = config.max_repeated_calls;
        let window_ms = config.time_window_ms;
        let now = chrono::Utc::now().timestamp_millis() as u64;

        if let Some(reset_time) = self.tripped_breakers.get(session_key) {
            if now < *reset_time {
                let remaining_sec = (*reset_time - now + 999) / 1000;
                return CircuitBreakerResult {
                    tripped: true,
                    reason: Some(format!("Circuit Breaker OPEN: Agent loop detected. Aborting tool calls for next {}s.", remaining_sec)),
                };
            }
        }

        let tracker_key = format!("{}:{}", session_key, tool_name);
        let params_hash = Self::hash_params(params);

        let mut history = self.call_tracker.entry(tracker_key.clone()).or_insert_with(Vec::new);

        let recent: Vec<CallRecord> = history.iter()
            .filter(|r| now.saturating_sub(r.timestamp) < window_ms)
            .cloned()
            .collect();

        let repeated_count = recent.iter().filter(|r| r.params_hash == params_hash).count() as u32;

        if repeated_count >= max_calls {
            self.tripped_breakers.insert(session_key.to_string(), now + 30000);
            return CircuitBreakerResult {
                tripped: true,
                reason: Some(format!(
                    "Circuit Breaker TRIPPED: Tool '{}' called {} times with identical parameters within {}s loop.",
                    tool_name, repeated_count + 1, window_ms / 1000
                )),
            };
        }

        recent.push(CallRecord { params_hash, timestamp: now });
        *history = recent;

        CircuitBreakerResult { tripped: false, reason: None }
    }

    pub fn reset(&self, session_key: &str) {
        self.tripped_breakers.remove(session_key);
    }

    fn hash_params(params: &HashMap<String, serde_json::Value>) -> String {
        let json = serde_json::to_string(params).unwrap_or_default();
        let mut hasher = Sha256::new();
        hasher.update(json.as_bytes());
        let result = hasher.finalize();
        hex::encode(result)
    }
}

#[derive(Debug, Clone)]
pub struct CircuitBreakerResult {
    pub tripped: bool,
    pub reason: Option<String>,
}