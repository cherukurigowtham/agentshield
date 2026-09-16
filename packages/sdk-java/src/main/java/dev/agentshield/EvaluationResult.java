package dev.agentshield;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class EvaluationResult {

    @JsonProperty("allowed")
    private boolean allowed;

    @JsonProperty("reason")
    private String reason;

    @JsonProperty("actionTaken")
    private ActionTaken actionTaken;

    @JsonProperty("timestamp")
    private String timestamp;

    @JsonProperty("remediation")
    private Remediation remediation;

    public EvaluationResult() {}

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private boolean allowed;
        private String reason;
        private ActionTaken actionTaken;
        private String timestamp;
        private Remediation remediation;

        public Builder allowed(boolean allowed) { this.allowed = allowed; return this; }
        public Builder reason(String reason) { this.reason = reason; return this; }
        public Builder actionTaken(ActionTaken actionTaken) { this.actionTaken = actionTaken; return this; }
        public Builder timestamp(String timestamp) { this.timestamp = timestamp; return this; }
        public Builder remediation(Remediation remediation) { this.remediation = remediation; return this; }

        public EvaluationResult build() {
            EvaluationResult result = new EvaluationResult();
            result.allowed = this.allowed;
            result.reason = this.reason;
            result.actionTaken = this.actionTaken;
            result.timestamp = this.timestamp;
            result.remediation = this.remediation;
            return result;
        }
    }

    public boolean isAllowed() { return allowed; }
    public void setAllowed(boolean allowed) { this.allowed = allowed; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public ActionTaken getActionTaken() { return actionTaken; }
    public void setActionTaken(ActionTaken actionTaken) { this.actionTaken = actionTaken; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

    public Remediation getRemediation() { return remediation; }
    public void setRemediation(Remediation remediation) { this.remediation = remediation; }

    public enum ActionTaken {
        @JsonProperty("ALLOW") ALLOW,
        @JsonProperty("BLOCK") BLOCK,
        @JsonProperty("REQUIRE_APPROVAL") REQUIRE_APPROVAL,
        @JsonProperty("CIRCUIT_TRIPPED") CIRCUIT_TRIPPED
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Remediation {
        @JsonProperty("status")
        private String status;

        @JsonProperty("suggestedFix")
        private String suggestedFix;

        @JsonProperty("maxAllowedValue")
        private Double maxAllowedValue;

        public Remediation() {}

        public Remediation(String status, String suggestedFix, Double maxAllowedValue) {
            this.status = status;
            this.suggestedFix = suggestedFix;
            this.maxAllowedValue = maxAllowedValue;
        }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public String getSuggestedFix() { return suggestedFix; }
        public void setSuggestedFix(String suggestedFix) { this.suggestedFix = suggestedFix; }

        public Double getMaxAllowedValue() { return maxAllowedValue; }
        public void setMaxAllowedValue(Double maxAllowedValue) { this.maxAllowedValue = maxAllowedValue; }
    }
}