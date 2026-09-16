package dev.agentshield;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.List;
import java.util.regex.Pattern;

public class PolicyEvaluator {

    private final Map<String, List<Long>> callHistory = new ConcurrentHashMap<>();
    private final Map<String, Double> sessionCosts = new ConcurrentHashMap<>();
    private final CircuitBreaker circuitBreaker = new CircuitBreaker();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public EvaluationResult evaluate(ToolCallRequest request, GuardrailPolicy policy) {
        String timestamp = Instant.now().toString();
        String sessionKey = request.getSessionId();
        if (sessionKey == null || sessionKey.isEmpty()) {
            sessionKey = request.getAgentId();
        }
        if (sessionKey == null || sessionKey.isEmpty()) {
            sessionKey = "default-session";
        }

        // 1. Circuit Breaker Evaluation
        if (policy.getCircuitBreaker() != null) {
            CircuitBreaker.CircuitBreakerResult cbCheck = circuitBreaker.check(sessionKey, request.getToolName(), request.getParams(), policy.getCircuitBreaker());
            if (cbCheck.isTripped()) {
                return EvaluationResult.builder()
                    .allowed(false)
                    .reason(cbCheck.getReason())
                    .actionTaken(EvaluationResult.ActionTaken.CIRCUIT_TRIPPED)
                    .timestamp(timestamp)
                    .remediation(new EvaluationResult.Remediation("BLOCKED", "Agent in retry loop. Abort current tool sequence and ask human for clarification.", null))
                    .build();
            }
        }

        // 2. Injection Sanitizer
        Boolean enableSanitizer = policy.getEnableInjectionSanitizer();
        if (enableSanitizer == null || enableSanitizer) {
            try {
                String payloadStr = objectMapper.writeValueAsString(request.getParams());
                InjectionSanitizer.InjectionSanitizeResult sanitizeRes = InjectionSanitizer.inspect(payloadStr);
                if (sanitizeRes.isDetected()) {
                    return EvaluationResult.builder()
                        .allowed(false)
                        .reason("Security Threat Detected: " + sanitizeRes.getType() + " (" + sanitizeRes.getPatternMatched() + ").")
                        .actionTaken(EvaluationResult.ActionTaken.BLOCK)
                        .timestamp(timestamp)
                        .remediation(new EvaluationResult.Remediation("BLOCKED", "Sanitize input payload to remove prompt overrides or hidden unicode characters.", null))
                        .build();
                }
            } catch (Exception e) {
                // Continue if serialization fails
            }
        }

        // 3. Allowed Tools Check
        if (policy.getAllowedTools() != null && !policy.getAllowedTools().isEmpty()) {
            if (!policy.getAllowedTools().contains(request.getToolName())) {
                return EvaluationResult.builder()
                    .allowed(false)
                    .reason("Tool '" + request.getToolName() + "' is not in the allowed tools list.")
                    .actionTaken(EvaluationResult.ActionTaken.BLOCK)
                    .timestamp(timestamp)
                    .remediation(new EvaluationResult.Remediation("BLOCKED", "Tool '" + request.getToolName() + "' is not authorized. Permitted tools: " + policy.getAllowedTools() + ".", null))
                    .build();
            }
        }

        // 4. Forbidden Tools Check
        if (policy.getForbiddenTools() != null && policy.getForbiddenTools().contains(request.getToolName())) {
            return EvaluationResult.builder()
                .allowed(false)
                .reason("Tool '" + request.getToolName() + "' is explicitly forbidden by policy.")
                .actionTaken(EvaluationResult.ActionTaken.BLOCK)
                .timestamp(timestamp)
                .remediation(new EvaluationResult.Remediation("BLOCKED", "Tool '" + request.getToolName() + "' is prohibited in production environment.", null))
                .build();
        }

        // 5. Required Parameter Fields Verification
        if (policy.getRequiredFields() != null) {
            for (String field : policy.getRequiredFields()) {
                if (!request.getParams().containsKey(field) || request.getParams().get(field) == null) {
                    return EvaluationResult.builder()
                        .allowed(false)
                        .reason("Missing required parameter field '" + field + "'.")
                        .actionTaken(EvaluationResult.ActionTaken.BLOCK)
                        .timestamp(timestamp)
                        .remediation(new EvaluationResult.Remediation("REQUIRES_REMEDIATION", "Provide required parameter '" + field + "' before invoking tool '" + request.getToolName() + "'.", null))
                        .build();
                }
            }
        }

        // 6. Rate Limit Evaluation
        if (policy.getRateLimit() != null && policy.getRateLimit().getMaxCallsPerMinute() != null) {
            long now = System.currentTimeMillis();
            long oneMinuteAgo = now - 60000;

            List<Long> timestamps = callHistory.getOrDefault(sessionKey, new ArrayList<>());
            List<Long> recent = timestamps.stream()
                .filter(t -> t > oneMinuteAgo)
                .collect(Collectors.toList());

            if (recent.size() >= policy.getRateLimit().getMaxCallsPerMinute()) {
                return EvaluationResult.builder()
                    .allowed(false)
                    .reason("Rate limit exceeded: Max " + policy.getRateLimit().getMaxCallsPerMinute() + " calls/min allowed.")
                    .actionTaken(EvaluationResult.ActionTaken.BLOCK)
                    .timestamp(timestamp)
                    .remediation(new EvaluationResult.Remediation("BLOCKED", "Wait 60 seconds before issuing further tool calls for session '" + sessionKey + "'.", null))
                    .build();
            }

            recent.add(now);
            callHistory.put(sessionKey, recent);
        }

        // 7. Financial & Session Budget Cap Check
        if (policy.getMaxCostPerSession() != null && request.getEstimatedCost() != null) {
            double currentCost = sessionCosts.getOrDefault(sessionKey, 0.0);
            double newCost = currentCost + request.getEstimatedCost();

            if (newCost > policy.getMaxCostPerSession()) {
                return EvaluationResult.builder()
                    .allowed(false)
                    .reason(String.format("Session cost threshold exceeded ($%.4f > $%.4f cap).", newCost, policy.getMaxCostPerSession()))
                    .actionTaken(EvaluationResult.ActionTaken.BLOCK)
                    .timestamp(timestamp)
                    .remediation(new EvaluationResult.Remediation("BLOCKED", String.format("Budget limit reached ($%.2f). Request budget approval.", policy.getMaxCostPerSession()), null))
                    .build();
            }
            sessionCosts.put(sessionKey, newCost);
        }

        // 8. Parameter Bound Verification
        if (policy.getMaxParamValues() != null) {
            for (Map.Entry<String, Double> entry : policy.getMaxParamValues().entrySet()) {
                String paramKey = entry.getKey();
                Double maxValue = entry.getValue();
                Object actualVal = request.getParams().get(paramKey);

                if (actualVal instanceof Number) {
                    double fv = ((Number) actualVal).doubleValue();
                    if (fv > maxValue) {
                        return EvaluationResult.builder()
                            .allowed(false)
                            .reason(String.format("Parameter '%s' value (%.0f) exceeds maximum allowed threshold (%.0f).", paramKey, fv, maxValue))
                            .actionTaken(EvaluationResult.ActionTaken.BLOCK)
                            .timestamp(timestamp)
                            .remediation(new EvaluationResult.Remediation("REQUIRES_REMEDIATION", String.format("Reduce '%s' parameter to <= %.0f.", paramKey, maxValue), maxValue))
                            .build();
                    }
                }
            }
        }

        // 9. Forbidden String/Regex Pattern Checks
        if (policy.getForbiddenPatterns() != null) {
            try {
                String paramStr = objectMapper.writeValueAsString(request.getParams());
                for (String patternStr : policy.getForbiddenPatterns()) {
                    Pattern regex = Pattern.compile(patternStr, Pattern.CASE_INSENSITIVE);
                    if (regex.matcher(paramStr).find()) {
                        return EvaluationResult.builder()
                            .allowed(false)
                            .reason("Parameter payload matched forbidden pattern: '" + patternStr + "'.")
                            .actionTaken(EvaluationResult.ActionTaken.BLOCK)
                            .timestamp(timestamp)
                            .remediation(new EvaluationResult.Remediation("BLOCKED", "Remove forbidden pattern '" + patternStr + "' from input payload.", null))
                            .build();
                    }
                }
            } catch (Exception e) {
                // Continue if serialization fails
            }
        }

        // 10. Approval Gate Check
        if (Boolean.TRUE.equals(policy.getRequireApproval())) {
            return EvaluationResult.builder()
                .allowed(false)
                .reason("Tool '" + request.getToolName() + "' requires human authorization prior to execution.")
                .actionTaken(EvaluationResult.ActionTaken.REQUIRE_APPROVAL)
                .timestamp(timestamp)
                .remediation(new EvaluationResult.Remediation("BLOCKED", "Request human authorization token.", null))
                .build();
        }

        return EvaluationResult.builder()
            .allowed(true)
            .actionTaken(EvaluationResult.ActionTaken.ALLOW)
            .timestamp(timestamp)
            .build();
    }
}