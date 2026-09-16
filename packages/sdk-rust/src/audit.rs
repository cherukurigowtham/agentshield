use sha2::{Sha256, Digest};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditRecord {
    pub record_id: String,
    pub previous_hash: String,
    pub hash: String,
    pub timestamp: String,
    pub agent_id: String,
    pub tool_name: String,
    pub action_taken: String,
    pub params_sanitized: HashMap<String, Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

pub struct AuditExporter {
    last_hash: Arc<Mutex<String>>,
    records: Arc<Mutex<Vec<AuditRecord>>>,
}

impl Default for AuditExporter {
    fn default() -> Self {
        Self::new()
    }
}

impl AuditExporter {
    pub fn new() -> Self {
        Self {
            last_hash: Arc::new(Mutex::new("GENESIS_HASH_00000000000000000000000000000000".to_string())),
            records: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn create_record(&self, request: &crate::types::ToolCallRequest, result: &crate::types::EvaluationResult) -> AuditRecord {
        let record_id = format!("rec_{}_{}", chrono::Utc::now().timestamp_millis(), uuid::Uuid::new_v4().simple().to_string().chars().take(6).collect::<String>());
        let timestamp = result.timestamp.clone().unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
        let agent_id = request.agent_id.clone().unwrap_or_else(|| "default-agent".to_string());

        let mut params_sanitized = request.params.clone();
        params_sanitized.insert("password".to_string(), Value::String("***MASKED***".to_string()));
        params_sanitized.insert("apiKey".to_string(), Value::String("***MASKED***".to_string()));

        let payload = json!({
            "recordId": record_id,
            "previousHash": *self.last_hash.lock().unwrap(),
            "timestamp": timestamp,
            "agentId": agent_id,
            "toolName": request.tool_name,
            "actionTaken": result.action_taken,
            "paramsSanitized": params_sanitized,
            "reason": result.reason
        });

        let hash = Self::compute_hash(&payload.to_string());
        *self.last_hash.lock().unwrap() = hash.clone();

        let record = AuditRecord {
            record_id,
            previous_hash: (*self.last_hash.lock().unwrap()).clone(),
            hash: hash.clone(),
            timestamp,
            agent_id,
            tool_name: request.tool_name.clone(),
            action_taken: format!("{:?}", result.action_taken),
            params_sanitized,
            reason: result.reason.clone(),
        };

        self.records.lock().unwrap().push(record.clone());
        record
    }

    pub fn export_soc2_log(&self) -> String {
        let records = self.records.lock().unwrap().clone();
        let output = json!({
            "version": "AgentShield-Audit-v1",
            "totalRecords": records.len(),
            "genesisHash": "GENESIS_HASH_00000000000000000000000000000000",
            "finalHash": *self.last_hash.lock().unwrap(),
            "auditChain": records
        });
        serde_json::to_string_pretty(&output).unwrap()
    }

    fn compute_hash(input: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(input.as_bytes());
        let result = hasher.finalize();
        format!("sha256_{}", hex::encode(result))
    }
}