package dev.agentshield;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.List;
import java.util.ArrayList;
import java.util.stream.Collectors;

public class CircuitBreaker {

    private static class CallRecord {
        String paramsHash;
        long timestamp;

        CallRecord(String paramsHash, long timestamp) {
            this.paramsHash = paramsHash;
            this.timestamp = timestamp;
        }
    }

    private final Map<String, List<CallRecord>> callTracker = new ConcurrentHashMap<>();
    private final Map<String, Long> trippedBreakers = new ConcurrentHashMap<>();

    public CircuitBreakerResult check(String sessionKey, String toolName, Map<String, Object> params, GuardrailPolicy.CircuitBreakerConfig config) {
        int maxCalls = config != null && config.getMaxRepeatedCalls() != null ? config.getMaxRepeatedCalls() : 4;
        int windowMs = config != null && config.getTimeWindowMs() != null ? config.getTimeWindowMs() : 10000;
        long now = System.currentTimeMillis();

        // Check if circuit breaker is currently open (tripped)
        Long resetTime = trippedBreakers.get(sessionKey);
        if (resetTime != null && now < resetTime) {
            long remainingSec = (resetTime - now + 999) / 1000;
            return new CircuitBreakerResult(true, "Circuit Breaker OPEN: Agent loop detected. Aborting tool calls for next " + remainingSec + "s.");
        }

        String trackerKey = sessionKey + ":" + toolName;
        String paramsHash = hashParams(params);

        List<CallRecord> history = callTracker.getOrDefault(trackerKey, new ArrayList<>());

        // Filter recent calls within time window
        List<CallRecord> recent = history.stream()
            .filter(record -> now - record.timestamp < windowMs)
            .collect(Collectors.toList());

        // Check for identical repeated tool calls
        long repeatedCount = recent.stream()
            .filter(record -> record.paramsHash.equals(paramsHash))
            .count();

        if (repeatedCount >= maxCalls) {
            // Trip the breaker for 30 seconds
            trippedBreakers.put(sessionKey, now + 30000);
            return new CircuitBreakerResult(true,
                "Circuit Breaker TRIPPED: Tool '" + toolName + "' called " + (repeatedCount + 1) + " times with identical parameters within " + (windowMs / 1000) + "s loop.");
        }

        recent.add(new CallRecord(paramsHash, now));
        callTracker.put(trackerKey, recent);

        return new CircuitBreakerResult(false, null);
    }

    public void reset(String sessionKey) {
        trippedBreakers.remove(sessionKey);
    }

    private String hashParams(Map<String, Object> params) {
        try {
            String json = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(params);
            long hash = 1469598103934665603L;
            for (byte b : json.getBytes()) {
                hash ^= b & 0xFF;
                hash *= 1099511628211L;
            }
            return Long.toHexString(hash);
        } catch (Exception e) {
            return params.toString();
        }
    }

    public static class CircuitBreakerResult {
        private boolean tripped;
        private String reason;

        public CircuitBreakerResult(boolean tripped, String reason) {
            this.tripped = tripped;
            this.reason = reason;
        }

        public boolean isTripped() { return tripped; }
        public String getReason() { return reason; }
    }
}