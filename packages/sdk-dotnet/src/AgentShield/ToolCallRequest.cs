using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace AgentShield;

public class ToolCallRequest
{
    [JsonPropertyName("toolName")]
    public string ToolName { get; set; } = string.Empty;

    [JsonPropertyName("params")]
    public Dictionary<string, object> Params { get; set; } = new();

    [JsonPropertyName("agentId")]
    public string? AgentId { get; set; }

    [JsonPropertyName("sessionId")]
    public string? SessionId { get; set; }

    [JsonPropertyName("estimatedCost")]
    public double? EstimatedCost { get; set; }

    public ToolCallRequest() { }

    public ToolCallRequest(string toolName, Dictionary<string, object>? paramsDict = null)
    {
        ToolName = toolName;
        Params = paramsDict ?? new Dictionary<string, object>();
    }
}

public class EvaluationResult
{
    [JsonPropertyName("allowed")]
    public bool Allowed { get; set; }

    [JsonPropertyName("reason")]
    public string? Reason { get; set; }

    [JsonPropertyName("actionTaken")]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public ActionTaken ActionTaken { get; set; }

    [JsonPropertyName("timestamp")]
    public string Timestamp { get; set; } = DateTime.UtcNow.ToString("O");

    [JsonPropertyName("remediation")]
    public Remediation? Remediation { get; set; }
}

public enum ActionTaken
{
    ALLOW,
    BLOCK,
    REQUIRE_APPROVAL,
    CIRCUIT_TRIPPED
}

public class Remediation
{
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("suggestedFix")]
    public string? SuggestedFix { get; set; }

    [JsonPropertyName("maxAllowedValue")]
    public double? MaxAllowedValue { get; set; }
}