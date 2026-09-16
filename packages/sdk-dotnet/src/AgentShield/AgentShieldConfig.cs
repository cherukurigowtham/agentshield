using System.Text.Json.Serialization;

namespace AgentShield;

public class AgentShieldConfig
{
    [JsonPropertyName("apiKey")]
    public string? ApiKey { get; set; }

    [JsonPropertyName("environment")]
    public string? Environment { get; set; }

    [JsonPropertyName("telemetryUrl")]
    public string? TelemetryUrl { get; set; }

    [JsonPropertyName("webhookUrl")]
    public string? WebhookUrl { get; set; }

    [JsonIgnore]
    public Action<EvaluationResult, ToolCallRequest>? OnViolation { get; set; }
}