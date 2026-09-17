use regex::Regex;
use base64::{Engine as _, engine::general_purpose};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InjectionSanitizeResult {
    pub detected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pattern_matched: Option<String>,
}

impl Default for InjectionSanitizeResult {
    fn default() -> Self {
        Self {
            detected: false,
            r#type: None,
            pattern_matched: None,
        }
    }
}

pub struct InjectionSanitizer;

impl InjectionSanitizer {
    fn indirect_injection_patterns() -> Vec<Regex> {
        vec![
            Regex::new(r"(?i)\[SYSTEM\s*OVERRIDE\]").unwrap(),
            Regex::new(r"(?i)IGNORE\s+ALL\s+PREVIOUS\s+INSTRUCTIONS").unwrap(),
            Regex::new(r"(?i)DISREGARD\s+PRIOR\s+RULES").unwrap(),
            Regex::new(r"(?i)YOU\s+ARE\s+NOW\s+IN\s+DAN\s+MODE").unwrap(),
            Regex::new(r"(?i)NEW\s+SYSTEM\s+PROMPT:").unwrap(),
            Regex::new(r"(?i)ADMIN_OVERRIDE_KEY").unwrap(),
        ]
    }

    fn destructive_patterns() -> Vec<Regex> {
        vec![
            Regex::new(r"(?i)DROP\s+TABLE").unwrap(),
            Regex::new(r"(?i)DELETE\s+FROM\s+[a-z_]+").unwrap(),
            Regex::new(r"(?i)TRUNCATE\s+TABLE").unwrap(),
            Regex::new(r"(?i)rm\s+-rf\s+").unwrap(),
            Regex::new(r"(?i)chmod\s+777").unwrap(),
            Regex::new(r"(?i)mkfs\.").unwrap(),
        ]
    }

    fn zero_width_regex() -> Regex {
        Regex::new(r"[\u200B-\u200D\uFEFF]").unwrap()
    }

    fn base64_regex() -> Regex {
        Regex::new(r"([A-Za-z0-9+/]{8,}={0,2})").unwrap()
    }

    pub fn inspect(payload: &str) -> InjectionSanitizeResult {
        let normalized = payload.replace("\\t", " ").replace("\\n", " ").replace("\\r", " ");

        if Self::zero_width_regex().is_match(&normalized) {
            return InjectionSanitizeResult {
                detected: true,
                r#type: Some("ZERO_WIDTH_UNICODE".to_string()),
                pattern_matched: Some("Hidden Zero-Width Unicode Characters Detected".to_string()),
            };
        }

        for pattern in Self::indirect_injection_patterns() {
            if pattern.is_match(&normalized) {
                return InjectionSanitizeResult {
                    detected: true,
                    r#type: Some("INDIRECT_PROMPT_INJECTION".to_string()),
                    pattern_matched: Some(pattern.as_str().to_string()),
                };
            }
        }

        for pattern in Self::destructive_patterns() {
            if pattern.is_match(&normalized) {
                return InjectionSanitizeResult {
                    detected: true,
                    r#type: Some("DESTRUCTIVE_PATTERN".to_string()),
                    pattern_matched: Some(pattern.as_str().to_string()),
                };
            }
        }

        for captures in Self::base64_regex().captures_iter(&normalized) {
            if let Some(m) = captures.get(1) {
                if let Ok(decoded_bytes) = general_purpose::STANDARD.decode(m.as_str()) {
                    if let Ok(decoded) = String::from_utf8(decoded_bytes) {
                        for pattern in Self::indirect_injection_patterns().into_iter().chain(Self::destructive_patterns()) {
                            if pattern.is_match(&decoded) {
                                return InjectionSanitizeResult {
                                    detected: true,
                                    r#type: Some("OBFUSCATED_PAYLOAD".to_string()),
                                    pattern_matched: Some(format!("Base64 Decoded: {}", pattern.as_str())),
                                };
                            }
                        }
                    }
                }
            }
        }

        InjectionSanitizeResult::default()
    }
}