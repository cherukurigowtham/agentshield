package dev.agentshield;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ToolCallRequest {

    @JsonProperty("toolName")
    private String toolName;

    @JsonProperty("params")
    private Map<String, Object> params;

    @JsonProperty("agentId")
    private String agentId;

    @JsonProperty("sessionId")
    private String sessionId;

    @JsonProperty("estimatedCost")
    private Double estimatedCost;

    public ToolCallRequest() {}

    public ToolCallRequest(String toolName, Map<String, Object> params) {
        this.toolName = toolName;
        this.params = params;
    }

    public String getToolName() { return toolName; }
    public void setToolName(String toolName) { this.toolName = toolName; }

    public Map<String, Object> getParams() { return params; }
    public void setParams(Map<String, Object> params) { this.params = params; }

    public String getAgentId() { return agentId; }
    public void setAgentId(String agentId) { this.agentId = agentId; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public Double getEstimatedCost() { return estimatedCost; }
    public void setEstimatedCost(Double estimatedCost) { this.estimatedCost = estimatedCost; }
}