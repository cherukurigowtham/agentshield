package agentshield

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

type AuditRecord struct {
	RecordID      string                 `json:"recordId"`
	PreviousHash  string                 `json:"previousHash"`
	Hash          string                 `json:"hash"`
	Timestamp     string                 `json:"timestamp"`
	AgentID       string                 `json:"agentId"`
	ToolName      string                 `json:"toolName"`
	ActionTaken   string                 `json:"actionTaken"`
	ParamsSanitized map[string]interface{} `json:"paramsSanitized"`
	Reason        string                 `json:"reason,omitempty"`
}

type AuditExporter struct {
	lastHash string
	records  []AuditRecord
	mu       sync.Mutex
}

func NewAuditExporter() *AuditExporter {
	return &AuditExporter{
		lastHash: "GENESIS_HASH_00000000000000000000000000000000",
		records:  make([]AuditRecord, 0),
	}
}

func (a *AuditExporter) CreateRecord(request ToolCallRequest, result EvaluationResult) AuditRecord {
	a.mu.Lock()
	defer a.mu.Unlock()

	recordID := fmt.Sprintf("rec_%d_%s", time.Now().UnixMilli(), randomString(6))
	timestamp := result.Timestamp
	if timestamp == "" {
		timestamp = time.Now().UTC().Format(time.RFC3339)
	}
	agentID := request.AgentID
	if agentID == "" {
		agentID = "default-agent"
	}

	paramsSanitized := make(map[string]interface{})
	for k, v := range request.Params {
		paramsSanitized[k] = v
	}
	if paramsSanitized["password"] != nil {
		paramsSanitized["password"] = "***MASKED***"
	}
	if paramsSanitized["apiKey"] != nil {
		paramsSanitized["apiKey"] = "***MASKED***"
	}

	payload := map[string]interface{}{
		"recordId":       recordID,
		"previousHash":   a.lastHash,
		"timestamp":      timestamp,
		"agentId":        agentID,
		"toolName":       request.ToolName,
		"actionTaken":    result.ActionTaken,
		"paramsSanitized": paramsSanitized,
		"reason":         result.Reason,
	}
	payloadBytes, _ := json.Marshal(payload)

	hash := computeHash(payloadBytes)
	a.lastHash = hash

	record := AuditRecord{
		RecordID:       recordID,
		PreviousHash:   a.lastHash,
		Hash:           hash,
		Timestamp:      timestamp,
		AgentID:        agentID,
		ToolName:       request.ToolName,
		ActionTaken:    string(result.ActionTaken),
		ParamsSanitized: paramsSanitized,
		Reason:         result.Reason,
	}

	a.records = append(a.records, record)
	return record
}

func (a *AuditExporter) ExportSOC2Log() string {
	a.mu.Lock()
	defer a.mu.Unlock()

	output := map[string]interface{}{
		"version":       "AgentShield-Audit-v1",
		"totalRecords":  len(a.records),
		"genesisHash":   "GENESIS_HASH_00000000000000000000000000000000",
		"finalHash":     a.lastHash,
		"auditChain":    a.records,
	}
	jsonBytes, _ := json.MarshalIndent(output, "", "  ")
	return string(jsonBytes)
}

func computeHash(data []byte) string {
	hash := sha256.Sum256(data)
	return "sha256_" + hex.EncodeToString(hash[:])
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
		time.Sleep(time.Nanosecond)
	}
	return string(b)
}