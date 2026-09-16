package dev.agentshield;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class OpenAIAdapter {

    private final AgentShield shield;
    private final ObjectMapper objectMapper;

    public OpenAIAdapter(AgentShield shield) {
        this.shield = shield != null ? shield : new AgentShield(new AgentShieldConfig());
        this.objectMapper = new ObjectMapper();
    }

    public static class OpenAIToolCall {
        private String id;
        private String type;
        private Function function;

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public Function getFunction() { return function; }
        public void setFunction(Function function) { this.function = function; }

        public static class Function {
            private String name;
            private String arguments;

            public String getName() { return name; }
            public void setName(String name) { this.name = name; }
            public String getArguments() { return arguments; }
            public void setArguments(String arguments) { this.arguments = arguments; }
        }
    }

    public static class ValidationResult {
        private List<OpenAIToolCall> validToolCalls = new ArrayList<>();
        private List<BlockedToolCall> blockedToolCalls = new ArrayList<>();

        public List<OpenAIToolCall> getValidToolCalls() { return validToolCalls; }
        public void setValidToolCalls(List<OpenAIToolCall> validToolCalls) { this.validToolCalls = validToolCalls; }
        public List<BlockedToolCall> getBlockedToolCalls() { return blockedToolCalls; }
        public void setBlockedToolCalls(List<BlockedToolCall> blockedToolCalls) { this.blockedToolCalls = blockedToolCalls; }
    }

    public static class BlockedToolCall {
        private OpenAIToolCall toolCall;
        private String reason;

        public OpenAIToolCall getToolCall() { return toolCall; }
        public void setToolCall(OpenAIToolCall toolCall) { this.toolCall = toolCall; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
    }

    public ValidationResult validateToolCalls(List<OpenAIToolCall> toolCalls, Map<String, GuardrailPolicy> policies) {
        ValidationResult result = new ValidationResult();

        for (OpenAIToolCall toolCall : toolCalls) {
            String toolName = toolCall.getFunction().getName();
            GuardrailPolicy policy = policies.get(toolName);
            if (policy == null) {
                policy = policies.get("*");
            }
            if (policy == null) {
                policy = new GuardrailPolicy();
            }

            Map<String, Object> parsedParams = Map.of();
            if (toolCall.getFunction().getArguments() != null && !toolCall.getFunction().getArguments().isEmpty()) {
                try {
                    parsedParams = objectMapper.readValue(toolCall.getFunction().getArguments(), Map.class);
                } catch (Exception e) {
                    parsedParams = Map.of("raw", toolCall.getFunction().getArguments());
                }
            }

            ToolCallRequest request = new ToolCallRequest();
            request.setToolName(toolName);
            request.setParams(parsedParams);

            EvaluationResult evalResult = shield.guard(request, policy);

            if (evalResult.isAllowed()) {
                result.getValidToolCalls().add(toolCall);
            } else {
                BlockedToolCall blocked = new BlockedToolCall();
                blocked.setToolCall(toolCall);
                blocked.setReason(evalResult.getReason());
                result.getBlockedToolCalls().add(blocked);
            }
        }

        return result;
    }
}