using System.Net.Http.Json;
using System.Text.Json;

namespace AgentShield;

public class AgentShield
{
    private readonly AgentShieldConfig _config;
    private readonly PolicyEvaluator _evaluator;
    private readonly HttpClient _httpClient;

    public AgentShield(AgentShieldConfig? config = null)
    {
        _config = config ?? new AgentShieldConfig();
        _evaluator = new PolicyEvaluator();
        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
    }

    public EvaluationResult Guard(ToolCallRequest request, GuardrailPolicy policy)
    {
        EvaluationResult result = _evaluator.Evaluate(request, policy);

        if (!result.Allowed)
        {
            _config.OnViolation?.Invoke(result, request);

            string webhookUrl = policy.WebhookUrl ?? _config.WebhookUrl;
            if (!string.IsNullOrEmpty(webhookUrl))
            {
                _ = DispatchWebhookAlert(result, request, webhookUrl);
            }
        }

        if (!string.IsNullOrEmpty(_config.TelemetryUrl))
        {
            _ = SendTelemetry(result, request);
        }

        return result;
    }

    public Func<T, Task<R>> WrapTool<T, R>(string toolName, Func<T, Task<R>> toolFn, GuardrailPolicy policy)
    {
        return async (input) =>
        {
            var request = new ToolCallRequest
            {
                ToolName = toolName,
                Params = input is Dictionary<string, object> dict ? dict : ConvertToParams(input)
            };

            EvaluationResult evalResult = Guard(request, policy);
            if (!evalResult.Allowed)
            {
                throw new AgentShieldException($"[AgentShield Blocked] {evalResult.Reason}");
            }

            if (policy.TimeoutMs > 0)
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(policy.TimeoutMs));
                try
                {
                    return await toolFn(input).WaitAsync(cts.Token);
                }
                catch (OperationCanceledException)
                {
                    throw new AgentShieldException($"[AgentShield Timeout] Execution timed out after {policy.TimeoutMs}ms");
                }
            }

            return await toolFn(input);
        };
    }

    public Func<T, R> WrapToolSync<T, R>(string toolName, Func<T, R> toolFn, GuardrailPolicy policy)
    {
        return (input) =>
        {
            var request = new ToolCallRequest
            {
                ToolName = toolName,
                Params = input is Dictionary<string, object> dict ? dict : ConvertToParams(input)
            };

            EvaluationResult evalResult = Guard(request, policy);
            if (!evalResult.Allowed)
            {
                throw new AgentShieldException($"[AgentShield Blocked] {evalResult.Reason}");
            }

            return toolFn(input);
        };
    }

    private Dictionary<string, object> ConvertToParams<T>(T input)
    {
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, object>>(JsonSerializer.Serialize(input))
                ?? new Dictionary<string, object> { ["input"] = input };
        }
        catch
        {
            return new Dictionary<string, object> { ["input"] = input };
        }
    }

    private async Task DispatchWebhookAlert(EvaluationResult result, ToolCallRequest request, string webhookUrl)
    {
        try
        {
            var payload = new
            {
                event = "AGENTSHIELD_VIOLATION_BLOCKED",
                toolName = request.ToolName,
                reason = result.Reason,
                timestamp = result.Timestamp,
                @params = request.Params
            };
            await _httpClient.PostAsJsonAsync(webhookUrl, payload);
        }
        catch
        {
            // Non-blocking background alert
        }
    }

    private async Task SendTelemetry(EvaluationResult result, ToolCallRequest request)
    {
        try
        {
            var payload = new
            {
                agentId = request.AgentId,
                toolName = request.ToolName,
                @params = request.Params,
                actionTaken = result.ActionTaken.ToString(),
                reason = result.Reason,
                timestamp = result.Timestamp
            };
            await _httpClient.PostAsJsonAsync(_config.TelemetryUrl!, payload);
        }
        catch
        {
            // Non-blocking telemetry sync
        }
    }
}

public class AgentShieldException : Exception
{
    public AgentShieldException(string message) : base(message) { }
}