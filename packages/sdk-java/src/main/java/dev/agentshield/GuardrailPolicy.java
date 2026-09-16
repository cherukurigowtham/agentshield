package dev.agentshield;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class GuardrailPolicy {

    @JsonProperty("allowedTools")
    private List<String> allowedTools;

    @JsonProperty("forbiddenTools")
    private List<String> forbiddenTools;

    @JsonProperty("maxParamValues")
    private Map<String, Double> maxParamValues;

    @JsonProperty("forbiddenPatterns")
    private List<String> forbiddenPatterns;

    @JsonProperty("requiredFields")
    private List<String> requiredFields;

    @JsonProperty("rateLimit")
    private RateLimitConfig rateLimit;

    @JsonProperty("maxCostPerSession")
    private Double maxCostPerSession;

    @JsonProperty("circuitBreaker")
    private CircuitBreakerConfig circuitBreaker;

    @JsonProperty("enableInjectionSanitizer")
    private Boolean enableInjectionSanitizer;

    @JsonProperty("timeoutMs")
    private Integer timeoutMs;

    @JsonProperty("requireApproval")
    private Boolean requireApproval;

    @JsonProperty("webhookUrl")
    private String webhookUrl;

    // Getters and setters
    public List<String> getAllowedTools() { return allowedTools; }
    public void setAllowedTools(List<String> allowedTools) { this.allowedTools = allowedTools; }

    public List<String> getForbiddenTools() { return forbiddenTools; }
    public void setForbiddenTools(List<String> forbiddenTools) { this.forbiddenTools = forbiddenTools; }

    public Map<String, Double> getMaxParamValues() { return maxParamValues; }
    public void setMaxParamValues(Map<String, Double> maxParamValues) { this.maxParamValues = maxParamValues; }

    public List<String> getForbiddenPatterns() { return forbiddenPatterns; }
    public void setForbiddenPatterns(List<String> forbiddenPatterns) { this.forbiddenPatterns = forbiddenPatterns; }

    public List<String> getRequiredFields() { return requiredFields; }
    public void setRequiredFields(List<String> requiredFields) { this.requiredFields = requiredFields; }

    public RateLimitConfig getRateLimit() { return rateLimit; }
    public void setRateLimit(RateLimitConfig rateLimit) { this.rateLimit = rateLimit; }

    public Double getMaxCostPerSession() { return maxCostPerSession; }
    public void setMaxCostPerSession(Double maxCostPerSession) { this.maxCostPerSession = maxCostPerSession; }

    public CircuitBreakerConfig getCircuitBreaker() { return circuitBreaker; }
    public void setCircuitBreaker(CircuitBreakerConfig circuitBreaker) { this.circuitBreaker = circuitBreaker; }

    public Boolean getEnableInjectionSanitizer() { return enableInjectionSanitizer; }
    public void setEnableInjectionSanitizer(Boolean enableInjectionSanitizer) { this.enableInjectionSanitizer = enableInjectionSanitizer; }

    public Integer getTimeoutMs() { return timeoutMs; }
    public void setTimeoutMs(Integer timeoutMs) { this.timeoutMs = timeoutMs; }

    public Boolean getRequireApproval() { return requireApproval; }
    public void setRequireApproval(Boolean requireApproval) { this.requireApproval = requireApproval; }

    public String getWebhookUrl() { return webhookUrl; }
    public void setWebhookUrl(String webhookUrl) { this.webhookUrl = webhookUrl; }

    public static class RateLimitConfig {
        @JsonProperty("maxCallsPerMinute")
        private Integer maxCallsPerMinute;

        public Integer getMaxCallsPerMinute() { return maxCallsPerMinute; }
        public void setMaxCallsPerMinute(Integer maxCallsPerMinute) { this.maxCallsPerMinute = maxCallsPerMinute; }
    }

    public static class CircuitBreakerConfig {
        @JsonProperty("maxRepeatedCalls")
        private Integer maxRepeatedCalls;

        @JsonProperty("timeWindowMs")
        private Integer timeWindowMs;

        public Integer getMaxRepeatedCalls() { return maxRepeatedCalls; }
        public void setMaxRepeatedCalls(Integer maxRepeatedCalls) { this.maxRepeatedCalls = maxRepeatedCalls; }

        public Integer getTimeWindowMs() { return timeWindowMs; }
        public void setTimeWindowMs(Integer timeWindowMs) { this.timeWindowMs = timeWindowMs; }
    }
}