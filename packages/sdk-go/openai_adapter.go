package agentshield

import (
	"encoding/json"
)

type OpenAIToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type OpenAIAdapter struct {
	shield *AgentShield
}

func NewOpenAIAdapter(shield *AgentShield) *OpenAIAdapter {
	if shield == nil {
		shield = New(AgentShieldConfig{})
	}
	return &OpenAIAdapter{shield: shield}
}

type ValidationResult struct {
	ValidToolCalls    []OpenAIToolCall `json:"validToolCalls"`
	BlockedToolCalls  []BlockedToolCall `json:"blockedToolCalls"`
}

type BlockedToolCall struct {
	ToolCall OpenAIToolCall `json:"toolCall"`
	Reason   string        `json:"reason"`
}

func (a *OpenAIAdapter) ValidateToolCalls(toolCalls []OpenAIToolCall, policies map[string]GuardrailPolicy) ValidationResult {
	var valid []OpenAIToolCall
	var blocked []BlockedToolCall

	for _, tc := range toolCalls {
		toolName := tc.Function.Name
		policy, exists := policies[toolName]
		if !exists {
			policy = policies["*"]
		}

		var parsedParams map[string]interface{}
		if tc.Function.Arguments != "" {
			json.Unmarshal([]byte(tc.Function.Arguments), &parsedParams)
		}
		if parsedParams == nil {
			parsedParams = map[string]interface{}{"raw": tc.Function.Arguments}
		}

		evalResult := a.shield.Guard(ToolCallRequest{
			ToolName: toolName,
			Params:   parsedParams,
		}, policy)

		if evalResult.Allowed {
			valid = append(valid, tc)
		} else {
			blocked = append(blocked, BlockedToolCall{
				ToolCall: tc,
				Reason:   evalResult.Reason,
			})
		}
	}

	return ValidationResult{
		ValidToolCalls:   valid,
		BlockedToolCalls: blocked,
	}
}