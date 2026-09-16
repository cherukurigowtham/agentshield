package dev.agentshield;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;

public class AuditExporter {

    private String lastHash = "GENESIS_HASH_00000000000000000000000000000000";
    private final List<AuditRecord> records = new ArrayList<>();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Random random = new Random();

    public AuditRecord createRecord(ToolCallRequest request, EvaluationResult result) {
        String recordId = "rec_" + System.currentTimeMillis() + "_" + randomString(6);
        String timestamp = result.getTimestamp() != null ? result.getTimestamp() : Instant.now().toString();
        String agentId = request.getAgentId() != null ? request.getAgentId() : "default-agent";

        Map<String, Object> paramsSanitized = new java.util.HashMap<>(request.getParams());
        if (paramsSanitized.containsKey("password")) {
            paramsSanitized.put("password", "***MASKED***");
        }
        if (paramsSanitized.containsKey("apiKey")) {
            paramsSanitized.put("apiKey", "***MASKED***");
        }

        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("recordId", recordId);
        payload.put("previousHash", lastHash);
        payload.put("timestamp", timestamp);
        payload.put("agentId", agentId);
        payload.put("toolName", request.getToolName());
        payload.put("actionTaken", result.getActionTaken().name());
        payload.set("paramsSanitized", objectMapper.valueToTree(paramsSanitized));
        if (result.getReason() != null) {
            payload.put("reason", result.getReason());
        }

        String hash = computeHash(payload.toString().getBytes(StandardCharsets.UTF_8));
        lastHash = hash;

        AuditRecord record = new AuditRecord();
        record.setRecordId(recordId);
        record.setPreviousHash(lastHash);
        record.setHash(hash);
        record.setTimestamp(timestamp);
        record.setAgentId(agentId);
        record.setToolName(request.getToolName());
        record.setActionTaken(result.getActionTaken().name());
        record.setParamsSanitized(paramsSanitized);
        record.setReason(result.getReason());

        records.add(record);
        return record;
    }

    public String exportSOC2Log() {
        try {
            ObjectNode output = objectMapper.createObjectNode();
            output.put("version", "AgentShield-Audit-v1");
            output.put("totalRecords", records.size());
            output.put("genesisHash", "GENESIS_HASH_00000000000000000000000000000000");
            output.put("finalHash", lastHash);
            output.set("auditChain", objectMapper.valueToTree(records));
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(output);
        } catch (Exception e) {
            throw new RuntimeException("Failed to export SOC2 log", e);
        }
    }

    private String computeHash(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data);
            StringBuilder hexString = new StringBuilder("sha256_");
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private String randomString(int length) {
        String chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    public static class AuditRecord {
        private String recordId;
        private String previousHash;
        private String hash;
        private String timestamp;
        private String agentId;
        private String toolName;
        private String actionTaken;
        private Map<String, Object> paramsSanitized;
        private String reason;

        public String getRecordId() { return recordId; }
        public void setRecordId(String recordId) { this.recordId = recordId; }
        public String getPreviousHash() { return previousHash; }
        public void setPreviousHash(String previousHash) { this.previousHash = previousHash; }
        public String getHash() { return hash; }
        public void setHash(String hash) { this.hash = hash; }
        public String getTimestamp() { return timestamp; }
        public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
        public String getAgentId() { return agentId; }
        public void setAgentId(String agentId) { this.agentId = agentId; }
        public String getToolName() { return toolName; }
        public void setToolName(String toolName) { this.toolName = toolName; }
        public String getActionTaken() { return actionTaken; }
        public void setActionTaken(String actionTaken) { this.actionTaken = actionTaken; }
        public Map<String, Object> getParamsSanitized() { return paramsSanitized; }
        public void setParamsSanitized(Map<String, Object> paramsSanitized) { this.paramsSanitized = paramsSanitized; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
    }
}