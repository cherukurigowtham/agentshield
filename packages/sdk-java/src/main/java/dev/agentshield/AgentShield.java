package dev.agentshield;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;

public class AgentShield {

    private final AgentShieldConfig config;
    private final PolicyEvaluator evaluator;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public AgentShield(AgentShieldConfig config) {
        this.config = config != null ? config : new AgentShieldConfig();
        this.evaluator = new PolicyEvaluator();
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
        this.objectMapper = new ObjectMapper();
    }

    public EvaluationResult guard(ToolCallRequest request, GuardrailPolicy policy) {
        EvaluationResult result = evaluator.evaluate(request, policy);

        if (!result.isAllowed()) {
            if (config.getOnViolation() != null) {
                config.getOnViolation().accept(result, request);
            }
            String webhookUrl = policy.getWebhookUrl();
            if (webhookUrl == null || webhookUrl.isEmpty()) {
                webhookUrl = config.getWebhookUrl();
            }
            if (webhookUrl != null && !webhookUrl.isEmpty()) {
                dispatchWebhookAlert(result, request, webhookUrl);
            }
        }

        if (config.getTelemetryUrl() != null && !config.getTelemetryUrl().isEmpty()) {
            sendTelemetry(result, request);
        }

        return result;
    }

    public <T, R> Function<T, R> wrapTool(String toolName, Function<T, R> toolFn, GuardrailPolicy policy) {
        return (input) -> {
            ToolCallRequest request = new ToolCallRequest();
            request.setToolName(toolName);
            if (input instanceof Map) {
                request.setParams((Map<String, Object>) input);
            } else {
                try {
                    request.setParams(objectMapper.convertValue(input, Map.class));
                } catch (Exception e) {
                    request.setParams(Map.of("input", input));
                }
            }

            EvaluationResult evalResult = guard(request, policy);
            if (!evalResult.isAllowed()) {
                throw new AgentShieldException("[AgentShield Blocked] " + evalResult.getReason());
            }

            if (policy.getTimeoutMs() != null && policy.getTimeoutMs() > 0) {
                return executeWithTimeout(() -> toolFn.apply(input), policy.getTimeoutMs());
            }

            return toolFn.apply(input);
        };
    }

    private <R> R executeWithTimeout(java.util.concurrent.Callable<R> task, int timeoutMs) {
        try {
            return CompletableFuture.supplyAsync(() -> {
                try {
                    return task.call();
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            }).get(timeoutMs, java.util.concurrent.TimeUnit.MILLISECONDS);
        } catch (java.util.concurrent.TimeoutException e) {
            throw new AgentShieldException("[AgentShield Timeout] Execution timed out after " + timeoutMs + "ms");
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private void dispatchWebhookAlert(EvaluationResult result, ToolCallRequest request, String webhookUrl) {
        try {
            Map<String, Object> payload = Map.of(
                "event", "AGENTSHIELD_VIOLATION_BLOCKED",
                "toolName", request.getToolName(),
                "reason", result.getReason(),
                "timestamp", result.getTimestamp(),
                "params", request.getParams()
            );
            String json = objectMapper.writeValueAsString(payload);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(webhookUrl))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

            httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.discarding());
        } catch (Exception ignored) {
            // Non-blocking background alert
        }
    }

    private void sendTelemetry(EvaluationResult result, ToolCallRequest request) {
        try {
            Map<String, Object> payload = Map.of(
                "agentId", request.getAgentId(),
                "toolName", request.getToolName(),
                "params", request.getParams(),
                "actionTaken", result.getActionTaken().name(),
                "reason", result.getReason(),
                "timestamp", result.getTimestamp()
            );
            String json = objectMapper.writeValueAsString(payload);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(config.getTelemetryUrl()))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

            httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.discarding());
        } catch (Exception ignored) {
            // Non-blocking telemetry sync
        }
    }

    public static class AgentShieldException extends RuntimeException {
        public AgentShieldException(String message) {
            super(message);
        }
    }
}