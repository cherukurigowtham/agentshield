package dev.agentshield;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.regex.Pattern;

public class InjectionSanitizer {

    private static final List<Pattern> INDIRECT_INJECTION_PATTERNS = List.of(
        Pattern.compile("\\[SYSTEM\\s*OVERRIDE\\]", Pattern.CASE_INSENSITIVE),
        Pattern.compile("IGNORE\\s+ALL\\s+PREVIOUS\\s+INSTRUCTIONS", Pattern.CASE_INSENSITIVE),
        Pattern.compile("DISREGARD\\s+PRIOR\\s+RULES", Pattern.CASE_INSENSITIVE),
        Pattern.compile("YOU\\s+ARE\\s+NOW\\s+IN\\s+DAN\\s+MODE", Pattern.CASE_INSENSITIVE),
        Pattern.compile("NEW\\s+SYSTEM\\s+PROMPT:", Pattern.CASE_INSENSITIVE),
        Pattern.compile("ADMIN_OVERRIDE_KEY", Pattern.CASE_INSENSITIVE)
    );

    private static final List<Pattern> DESTRUCTIVE_PATTERNS = List.of(
        Pattern.compile("DROP\\s+TABLE", Pattern.CASE_INSENSITIVE),
        Pattern.compile("DELETE\\s+FROM\\s+[a-z_]+", Pattern.CASE_INSENSITIVE),
        Pattern.compile("TRUNCATE\\s+TABLE", Pattern.CASE_INSENSITIVE),
        Pattern.compile("rm\\s+-rf\\s+", Pattern.CASE_INSENSITIVE),
        Pattern.compile("chmod\\s+777", Pattern.CASE_INSENSITIVE),
        Pattern.compile("mkfs\\.", Pattern.CASE_INSENSITIVE)
    );

    private static final Pattern ZERO_WIDTH_REGEX = Pattern.compile("[\u200B-\u200D\uFEFF]");
    private static final Pattern BASE64_REGEX = Pattern.compile("([A-Za-z0-9+/]{8,}={0,2})");

    public static class InjectionSanitizeResult {
        private boolean detected;
        private String type;
        private String patternMatched;

        public boolean isDetected() { return detected; }
        public void setDetected(boolean detected) { this.detected = detected; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public String getPatternMatched() { return patternMatched; }
        public void setPatternMatched(String patternMatched) { this.patternMatched = patternMatched; }
    }

    public static InjectionSanitizeResult inspect(String payloadStr) {
        String normalizedPayload = payloadStr.replaceAll("\\\\t|\\\\n|\\\\r", " ");

        // 1. Check Zero-Width Unicode Characters
        if (ZERO_WIDTH_REGEX.matcher(normalizedPayload).find()) {
            InjectionSanitizeResult result = new InjectionSanitizeResult();
            result.setDetected(true);
            result.setType("ZERO_WIDTH_UNICODE");
            result.setPatternMatched("Hidden Zero-Width Unicode Characters Detected");
            return result;
        }

        // 2. Check Indirect Prompt Injection Patterns
        for (Pattern pattern : INDIRECT_INJECTION_PATTERNS) {
            if (pattern.matcher(normalizedPayload).find()) {
                InjectionSanitizeResult result = new InjectionSanitizeResult();
                result.setDetected(true);
                result.setType("INDIRECT_PROMPT_INJECTION");
                result.setPatternMatched(pattern.pattern());
                return result;
            }
        }

        // 3. Check Destructive Patterns
        for (Pattern pattern : DESTRUCTIVE_PATTERNS) {
            if (pattern.matcher(normalizedPayload).find()) {
                InjectionSanitizeResult result = new InjectionSanitizeResult();
                result.setDetected(true);
                result.setType("DESTRUCTIVE_PATTERN");
                result.setPatternMatched(pattern.pattern());
                return result;
            }
        }

        // 4. Base64 Obfuscation Inspection
        var matcher = BASE64_REGEX.matcher(normalizedPayload);
        while (matcher.find()) {
            try {
                String decoded = new String(Base64.getDecoder().decode(matcher.group(1)));
                for (Pattern pattern : new ArrayList<>(INDIRECT_INJECTION_PATTERNS)) {
                    if (pattern.matcher(decoded).find()) {
                        InjectionSanitizeResult result = new InjectionSanitizeResult();
                        result.setDetected(true);
                        result.setType("OBFUSCATED_PAYLOAD");
                        result.setPatternMatched("Base64 Decoded: " + pattern.pattern());
                        return result;
                    }
                }
                for (Pattern pattern : DESTRUCTIVE_PATTERNS) {
                    if (pattern.matcher(decoded).find()) {
                        InjectionSanitizeResult result = new InjectionSanitizeResult();
                        result.setDetected(true);
                        result.setType("OBFUSCATED_PAYLOAD");
                        result.setPatternMatched("Base64 Decoded: " + pattern.pattern());
                        return result;
                    }
                }
            } catch (Exception ignored) {
                // Not valid Base64
            }
        }

        return new InjectionSanitizeResult();
    }
}