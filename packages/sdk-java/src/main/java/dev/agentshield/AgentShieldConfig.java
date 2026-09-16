package dev.agentshield;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.function.BiConsumer;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class AgentShieldConfig {

    @JsonProperty("apiKey")
    private String apiKey;

    @JsonProperty("environment")
    private String environment;

    @JsonProperty("telemetryUrl")
    private String telemetryUrl;

    @JsonProperty("webhookUrl")
    private String webhookUrl;

    // Not serialized - used for callbacks
    private transient BiConsumer<EvaluationResult, ToolCallRequest> onViolation;

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }

    public String getEnvironment() { return environment; }
    public void setEnvironment(String environment) { this.environment = environment; }

    public String getTelemetryUrl() { return telemetryUrl; }
    public void setTelemetryUrl(String telemetryUrl) { this.telemetryUrl = telemetryUrl; }

    public String getWebhookUrl() { return webhookUrl; }
    public void setWebhookUrl(String webhookUrl) { this.webhookUrl = webhookUrl; }

    public BiConsumer<EvaluationResult, ToolCallRequest> getOnViolation() { return onViolation; }
    public void setOnViolation(BiConsumer<EvaluationResult, ToolCallRequest> onViolation) { this.onViolation = onViolation; }
}