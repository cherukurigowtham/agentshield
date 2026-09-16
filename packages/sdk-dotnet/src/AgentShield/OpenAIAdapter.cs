using System.Collections.Generic;
using System.Text.Json;

namespace AgentShield;

public class OpenAIAdapter
{
    private readonly AgentShield _shield;

    public OpenAIAdapter(AgentShield? shield = null)
    {
        _shield = shield ?? new AgentShield();
    }

    public class OpenAIToolCall
    {
        public string Id { get; set; } = string.Empty;
        public string Type { get; set; } = "function";
        public Function Function { get; set; } = new();
    }

    public class Function
    {
        public string Name { get; set; } = string.Empty;
        public string Arguments { get; set; } = string.Empty;
    }

    public class ValidationResult
    {
        public List<OpenAIToolCall> ValidToolCalls { get; set; } = new();
        public List<BlockedToolCall> BlockedToolCalls { get; set; } = new();
    }

    public class BlockedToolCall
    {
        public OpenAIToolCall ToolCall { get; set; } = new();
        public string Reason { get; set; } = string.Empty;
    }

    public ValidationResult ValidateToolCalls(List<OpenAIToolCall> toolCalls, Dictionary<string, GuardrailPolicy> policies)
    {
        var result = new ValidationResult();

        foreach (var toolCall in toolCalls)
        {
            string toolName = toolCall.Function.Name;
            if (!policies.TryGetValue(toolName, out var policy))
            {
                policies.TryGetValue("*", out policy);
            }
            policy ??= new GuardrailPolicy();

            Dictionary<string, object> parsedParams = new();
            if (!string.IsNullOrEmpty(toolCall.Function.Arguments))
            {
                try
                {
                    parsedParams = JsonSerializer.Deserialize<Dictionary<string, object>>(toolCall.Function.Arguments)
                        ?? new Dictionary<string, object>();
                }
                catch
                {
                    parsedParams = new Dictionary<string, object> { ["raw"] = toolCall.Function.Arguments };
                }
            }

            var request = new ToolCallRequest
            {
                ToolName = toolName,
                Params = parsedParams
            };

            var evalResult = _shield.Guard(request, policy);

            if (evalResult.Allowed)
            {
                result.ValidToolCalls.Add(toolCall);
            }
            else
            {
                result.BlockedToolCalls.Add(new BlockedToolCall
                {
                    ToolCall = toolCall,
                    Reason = evalResult.Reason ?? "Blocked by policy"
                });
            }
        }

        return result;
    }
}