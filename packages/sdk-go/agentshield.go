package agentshield

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type AgentShield struct {
	config    AgentShieldConfig
	evaluator *PolicyEvaluator
	client    *http.Client
}

func New(config AgentShieldConfig) *AgentShield {
	return &AgentShield{
		config:    config,
		evaluator: NewPolicyEvaluator(),
		client:    &http.Client{Timeout: 5 * time.Second},
	}
}

func (s *AgentShield) Guard(request ToolCallRequest, policy GuardrailPolicy) EvaluationResult {
	result := s.evaluator.Evaluate(request, policy)

	if !result.Allowed {
		if s.config.OnViolation != nil {
			s.config.OnViolation(result, request)
		}
		webhookURL := policy.WebhookURL
		if webhookURL == "" {
			webhookURL = s.config.WebhookURL
		}
		if webhookURL != "" {
			go s.dispatchWebhookAlert(result, request, webhookURL)
		}
	}

	if s.config.TelemetryURL != "" {
		go s.sendTelemetry(result, request)
	}

	return result
}

func (s *AgentShield) WrapTool(toolName string, toolFn func(map[string]interface{}) (interface{}, error), policy GuardrailPolicy) func(map[string]interface{}) (interface{}, error) {
	return func(params map[string]interface{}) (interface{}, error) {
		request := ToolCallRequest{
			ToolName: toolName,
			Params:   params,
		}
		evalResult := s.Guard(request, policy)
		if !evalResult.Allowed {
			return nil, fmt.Errorf("[AgentShield Blocked] %s", evalResult.Reason)
		}

		if policy.TimeoutMs > 0 {
			ctx, cancel := context.WithTimeout(context.Background(), time.Duration(policy.TimeoutMs)*time.Millisecond)
			defer cancel()

			type result struct {
				val interface{}
				err error
			}
			resultChan := make(chan result, 1)
			go func() {
				val, err := toolFn(params)
				resultChan <- result{val, err}
			}()

			select {
			case res := <-resultChan:
				return res.val, res.err
			case <-ctx.Done():
				return nil, fmt.Errorf("[AgentShield Timeout] Execution timed out after %dms", policy.TimeoutMs)
			}
		}

		return toolFn(params)
	}
}

func (s *AgentShield) dispatchWebhookAlert(result EvaluationResult, request ToolCallRequest, webhookURL string) {
	payload := map[string]interface{}{
		"event":      "AGENTSHIELD_VIOLATION_BLOCKED",
		"toolName":   request.ToolName,
		"reason":     result.Reason,
		"timestamp":  result.Timestamp,
		"params":     request.Params,
	}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", webhookURL, nil)
	req.Header.Set("Content-Type", "application/json")
	req.Body = http.NoBody
	req.GetBody = func() (io.ReadCloser, error) {
		return io.NopCloser(bytes.NewReader(body)), nil
	}
	s.client.Do(req)
}

func (s *AgentShield) sendTelemetry(result EvaluationResult, request ToolCallRequest) {
	payload := map[string]interface{}{
		"agentId":     request.AgentID,
		"toolName":    request.ToolName,
		"params":      request.Params,
		"actionTaken": result.ActionTaken,
		"reason":      result.Reason,
		"timestamp":   result.Timestamp,
	}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", s.config.TelemetryURL, nil)
	req.Header.Set("Content-Type", "application/json")
	req.Body = http.NoBody
	req.GetBody = func() (io.ReadCloser, error) {
		return io.NopCloser(bytes.NewReader(body)), nil
	}
	s.client.Do(req)
}

func Shield(toolName string, toolFn func(map[string]interface{}) (interface{}, error), policy GuardrailPolicy) func(map[string]interface{}) (interface{}, error) {
	globalShield := New(AgentShieldConfig{})
	return globalShield.WrapTool(toolName, toolFn, policy)
}