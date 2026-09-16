package agentshield

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sync"
	"time"
)

type PolicyEvaluator struct {
	callHistory map[string][]int64
	sessionCost map[string]float64
	circuitBreaker *CircuitBreaker
	mu sync.RWMutex
}

func NewPolicyEvaluator() *PolicyEvaluator {
	return &PolicyEvaluator{
		callHistory:    make(map[string][]int64),
		sessionCost:    make(map[string]float64),
		circuitBreaker: NewCircuitBreaker(),
	}
}

func (e *PolicyEvaluator) Evaluate(request ToolCallRequest, policy GuardrailPolicy) EvaluationResult {
	timestamp := time.Now().UTC().Format(time.RFC3339)
	sessionKey := request.SessionID
	if sessionKey == "" {
		sessionKey = request.AgentID
	}
	if sessionKey == "" {
		sessionKey = "default-session"
	}

	if policy.CircuitBreaker != nil {
		cbCheck := e.circuitBreaker.Check(sessionKey, request.ToolName, request.Params, *policy.CircuitBreaker)
		if cbCheck.Tripped {
			return EvaluationResult{
				Allowed:     false,
				Reason:      cbCheck.Reason,
				ActionTaken: ActionCircuitTripped,
				Timestamp:   timestamp,
				Remediation: &Remediation{
					Status:       "BLOCKED",
					SuggestedFix: "Agent in retry loop. Abort current tool sequence and ask human for clarification.",
				},
			}
		}
	}

	if policy.EnableInjectionSanitizer != false {
		payloadStr, _ := json.Marshal(request.Params)
		sanitizeRes := InspectInjection(string(payloadStr))
		if sanitizeRes.Detected {
			return EvaluationResult{
				Allowed:     false,
				Reason:      fmt.Sprintf("Security Threat Detected: %s (%s).", sanitizeRes.Type, sanitizeRes.PatternMatched),
				ActionTaken: ActionBlock,
				Timestamp:   timestamp,
				Remediation: &Remediation{
					Status:       "BLOCKED",
					SuggestedFix: "Sanitize input payload to remove prompt overrides or hidden unicode characters.",
				},
			}
		}
	}

	if len(policy.AllowedTools) > 0 {
		allowed := false
		for _, t := range policy.AllowedTools {
			if t == request.ToolName {
				allowed = true
				break
			}
		}
		if !allowed {
			return EvaluationResult{
				Allowed:     false,
				Reason:      fmt.Sprintf("Tool '%s' is not in the allowed tools list.", request.ToolName),
				ActionTaken: ActionBlock,
				Timestamp:   timestamp,
				Remediation: &Remediation{
					Status:       "BLOCKED",
					SuggestedFix: fmt.Sprintf("Tool '%s' is not authorized. Permitted tools: %v.", request.ToolName, policy.AllowedTools),
				},
			}
		}
	}

	for _, t := range policy.ForbiddenTools {
		if t == request.ToolName {
			return EvaluationResult{
				Allowed:     false,
				Reason:      fmt.Sprintf("Tool '%s' is explicitly forbidden by policy.", request.ToolName),
				ActionTaken: ActionBlock,
				Timestamp:   timestamp,
				Remediation: &Remediation{
					Status:       "BLOCKED",
					SuggestedFix: fmt.Sprintf("Tool '%s' is prohibited in production environment.", request.ToolName),
				},
			}
		}
	}

	for _, field := range policy.RequiredFields {
		if _, ok := request.Params[field]; !ok {
			return EvaluationResult{
				Allowed:     false,
				Reason:      fmt.Sprintf("Missing required parameter field '%s'.", field),
				ActionTaken: ActionBlock,
				Timestamp:   timestamp,
				Remediation: &Remediation{
					Status:       "REQUIRES_REMEDIATION",
					SuggestedFix: fmt.Sprintf("Provide required parameter '%s' before invoking tool '%s'.", field, request.ToolName),
				},
			}
		}
	}

	if policy.RateLimit != nil {
		e.mu.Lock()
		now := time.Now().UnixMilli()
		oneMinuteAgo := now - 60000

		timestamps := e.callHistory[sessionKey]
		var recent []int64
		for _, t := range timestamps {
			if t > oneMinuteAgo {
				recent = append(recent, t)
			}
		}

		if len(recent) >= policy.RateLimit.MaxCallsPerMinute {
			e.mu.Unlock()
			return EvaluationResult{
				Allowed:     false,
				Reason:      fmt.Sprintf("Rate limit exceeded: Max %d calls/min allowed.", policy.RateLimit.MaxCallsPerMinute),
				ActionTaken: ActionBlock,
				Timestamp:   timestamp,
				Remediation: &Remediation{
					Status:       "BLOCKED",
					SuggestedFix: fmt.Sprintf("Wait 60 seconds before issuing further tool calls for session '%s'.", sessionKey),
				},
			}
		}

		recent = append(recent, now)
		e.callHistory[sessionKey] = recent
		e.mu.Unlock()
	}

	if policy.MaxCostPerSession > 0 && request.EstimatedCost > 0 {
		e.mu.Lock()
		currentCost := e.sessionCost[sessionKey]
		newCost := currentCost + request.EstimatedCost

		if newCost > policy.MaxCostPerSession {
			e.mu.Unlock()
			return EvaluationResult{
				Allowed:     false,
				Reason:      fmt.Sprintf("Session cost threshold exceeded ($%.4f > $%.4f cap).", newCost, policy.MaxCostPerSession),
				ActionTaken: ActionBlock,
				Timestamp:   timestamp,
				Remediation: &Remediation{
					Status:       "BLOCKED",
					SuggestedFix: fmt.Sprintf("Budget limit reached ($%.2f). Request budget approval.", policy.MaxCostPerSession),
				},
			}
		}
		e.sessionCost[sessionKey] = newCost
		e.mu.Unlock()
	}

	for paramKey, maxValue := range policy.MaxParamValues {
		if actualVal, ok := request.Params[paramKey]; ok {
			var fv float64
			switch v := actualVal.(type) {
			case float64:
				fv = v
			case int:
				fv = float64(v)
			case int64:
				fv = float64(v)
			case json.Number:
				fv, _ = v.Float64()
			default:
				continue
			}
			if fv > maxValue {
				return EvaluationResult{
					Allowed:     false,
					Reason:      fmt.Sprintf("Parameter '%s' value (%.0f) exceeds maximum allowed threshold (%.0f).", paramKey, fv, maxValue),
					ActionTaken: ActionBlock,
					Timestamp:   timestamp,
					Remediation: &Remediation{
						Status:          "REQUIRES_REMEDIATION",
						SuggestedFix:    fmt.Sprintf("Reduce '%s' parameter to <= %.0f.", paramKey, maxValue),
						MaxAllowedValue: maxValue,
					},
				}
			}
		}
	}

	payloadStr, _ := json.Marshal(request.Params)
	for _, patternStr := range policy.ForbiddenPatterns {
		matched, _ := regexp.MatchString("(?i)"+patternStr, string(payloadStr))
		if matched {
			return EvaluationResult{
				Allowed:     false,
				Reason:      fmt.Sprintf("Parameter payload matched forbidden pattern: '%s'.", patternStr),
				ActionTaken: ActionBlock,
				Timestamp:   timestamp,
				Remediation: &Remediation{
					Status:       "BLOCKED",
					SuggestedFix: fmt.Sprintf("Remove forbidden pattern '%s' from input payload.", patternStr),
				},
			}
		}
	}

	if policy.RequireApproval {
		return EvaluationResult{
			Allowed:     false,
			Reason:      fmt.Sprintf("Tool '%s' requires human authorization prior to execution.", request.ToolName),
			ActionTaken: ActionRequireApproval,
			Timestamp:   timestamp,
			Remediation: &Remediation{
				Status:       "BLOCKED",
				SuggestedFix: "Request human authorization token.",
			},
		}
	}

	return EvaluationResult{
		Allowed:     true,
		ActionTaken: ActionAllow,
		Timestamp:   timestamp,
	}
}