package agentshield

import (
	"encoding/base64"
	"regexp"
)

type GuardrailPolicy struct {
	AllowedTools             []string               `json:"allowedTools,omitempty"`
	ForbiddenTools           []string               `json:"forbiddenTools,omitempty"`
	MaxParamValues           map[string]float64     `json:"maxParamValues,omitempty"`
	ForbiddenPatterns        []string               `json:"forbiddenPatterns,omitempty"`
	RequiredFields           []string               `json:"requiredFields,omitempty"`
	RateLimit                *RateLimitConfig       `json:"rateLimit,omitempty"`
	MaxCostPerSession        float64                `json:"maxCostPerSession,omitempty"`
	CircuitBreaker           *CircuitBreakerConfig  `json:"circuitBreaker,omitempty"`
	EnableInjectionSanitizer bool                   `json:"enableInjectionSanitizer,omitempty"`
	TimeoutMs                int                    `json:"timeoutMs,omitempty"`
	RequireApproval          bool                   `json:"requireApproval,omitempty"`
	WebhookURL               string                 `json:"webhookUrl,omitempty"`
}

type RateLimitConfig struct {
	MaxCallsPerMinute int `json:"maxCallsPerMinute"`
}

type CircuitBreakerConfig struct {
	MaxRepeatedCalls int `json:"maxRepeatedCalls,omitempty"`
	TimeWindowMs     int `json:"timeWindowMs,omitempty"`
}

type ToolCallRequest struct {
	ToolName      string                 `json:"toolName"`
	Params        map[string]interface{} `json:"params"`
	AgentID       string                 `json:"agentId,omitempty"`
	SessionID     string                 `json:"sessionId,omitempty"`
	EstimatedCost float64                `json:"estimatedCost,omitempty"`
}

type EvaluationResult struct {
	Allowed      bool          `json:"allowed"`
	Reason       string        `json:"reason,omitempty"`
	ActionTaken  ActionTaken   `json:"actionTaken"`
	Timestamp    string        `json:"timestamp"`
	Remediation  *Remediation  `json:"remediation,omitempty"`
}

type ActionTaken string

const (
	ActionAllow           ActionTaken = "ALLOW"
	ActionBlock           ActionTaken = "BLOCK"
	ActionRequireApproval ActionTaken = "REQUIRE_APPROVAL"
	ActionCircuitTripped  ActionTaken = "CIRCUIT_TRIPPED"
)

type Remediation struct {
	Status          string  `json:"status"`
	SuggestedFix    string  `json:"suggestedFix,omitempty"`
	MaxAllowedValue float64 `json:"maxAllowedValue,omitempty"`
}

type AgentShieldConfig struct {
	APIKey       string                       `json:"apiKey,omitempty"`
	Environment  string                       `json:"environment,omitempty"`
	TelemetryURL string                       `json:"telemetryUrl,omitempty"`
	WebhookURL   string                       `json:"webhookUrl,omitempty"`
	OnViolation  func(EvaluationResult, ToolCallRequest)
}

var (
	indirectInjectionPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)\[SYSTEM\s*OVERRIDE\]`),
		regexp.MustCompile(`(?i)IGNORE\s+ALL\s+PREVIOUS\s+INSTRUCTIONS`),
		regexp.MustCompile(`(?i)DISREGARD\s+PRIOR\s+RULES`),
		regexp.MustCompile(`(?i)YOU\s+ARE\s+NOW\s+IN\s+DAN\s+MODE`),
		regexp.MustCompile(`(?i)NEW\s+SYSTEM\s+PROMPT:`),
		regexp.MustCompile(`(?i)ADMIN_OVERRIDE_KEY`),
	}

	destructivePatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)DROP\s+TABLE`),
		regexp.MustCompile(`(?i)DELETE\s+FROM\s+[a-z_]+`),
		regexp.MustCompile(`(?i)TRUNCATE\s+TABLE`),
		regexp.MustCompile(`(?i)rm\s+-rf\s+`),
		regexp.MustCompile(`(?i)chmod\s+777`),
		regexp.MustCompile(`(?i)mkfs\.`),
	}

	zeroWidthRegex = regexp.MustCompile("[\u200B-\u200D\uFEFF]")
	base64Regex    = regexp.MustCompile(`([A-Za-z0-9+/]{8,}={0,2})`)
)

type InjectionSanitizeResult struct {
	Detected       bool   `json:"detected"`
	Type           string `json:"type,omitempty"`
	PatternMatched string `json:"patternMatched,omitempty"`
}

func InspectInjection(payload string) InjectionSanitizeResult {
	normalized := regexp.MustCompile(`\\t|\\n|\\r`).ReplaceAllString(payload, " ")

	if zeroWidthRegex.MatchString(normalized) {
		return InjectionSanitizeResult{
			Detected:       true,
			Type:           "ZERO_WIDTH_UNICODE",
			PatternMatched: "Hidden Zero-Width Unicode Characters Detected",
		}
	}

	for _, pattern := range indirectInjectionPatterns {
		if pattern.MatchString(normalized) {
			return InjectionSanitizeResult{
				Detected:       true,
				Type:           "INDIRECT_PROMPT_INJECTION",
				PatternMatched: pattern.String(),
			}
		}
	}

	for _, pattern := range destructivePatterns {
		if pattern.MatchString(normalized) {
			return InjectionSanitizeResult{
				Detected:       true,
				Type:           "DESTRUCTIVE_PATTERN",
				PatternMatched: pattern.String(),
			}
		}
	}

	matches := base64Regex.FindAllStringSubmatch(normalized, -1)
	for _, match := range matches {
		if len(match) > 1 {
			decoded, err := base64.StdEncoding.DecodeString(match[1])
			if err == nil {
				decodedStr := string(decoded)
				for _, pattern := range append(indirectInjectionPatterns, destructivePatterns...) {
					if pattern.MatchString(decodedStr) {
						return InjectionSanitizeResult{
							Detected:       true,
							Type:           "OBFUSCATED_PAYLOAD",
							PatternMatched: "Base64 Decoded: " + pattern.String(),
						}
					}
				}
			}
		}
	}

	return InjectionSanitizeResult{Detected: false}
}