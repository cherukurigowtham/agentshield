using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace AgentShield;

public class GuardrailPolicy
{
    [JsonPropertyName("allowedTools")]
    public List<string>? AllowedTools { get; set; }

    [JsonPropertyName("forbiddenTools")]
    public List<string>? ForbiddenTools { get; set; }

    [JsonPropertyName("maxParamValues")]
    public Dictionary<string, double>? MaxParamValues { get; set; }

    [JsonPropertyName("forbiddenPatterns")]
    public List<string>? ForbiddenPatterns { get; set; }

    [JsonPropertyName("requiredFields")]
    public List<string>? RequiredFields { get; set; }

    [JsonPropertyName("rateLimit")]
    public RateLimitConfig? RateLimit { get; set; }

    [JsonPropertyName("maxCostPerSession")]
    public double? MaxCostPerSession { get; set; }

    [JsonPropertyName("circuitBreaker")]
    public CircuitBreakerConfig? CircuitBreaker { get; set; }

    [JsonPropertyName("enableInjectionSanitizer")]
    public bool? EnableInjectionSanitizer { get; set; }

    [JsonPropertyName("timeoutMs")]
    public int? TimeoutMs { get; set; }

    [JsonPropertyName("requireApproval")]
    public bool? RequireApproval { get; set; }

    [JsonPropertyName("webhookUrl")]
    public string? WebhookUrl { get; set; }
}

public class RateLimitConfig
{
    [JsonPropertyName("maxCallsPerMinute")]
    public int MaxCallsPerMinute { get; set; }
}

public class CircuitBreakerConfig
{
    [JsonPropertyName("maxRepeatedCalls")]
    public int MaxRepeatedCalls { get; set; } = 4;

    [JsonPropertyName("timeWindowMs")]
    public int TimeWindowMs { get; set; } = 10000;
}