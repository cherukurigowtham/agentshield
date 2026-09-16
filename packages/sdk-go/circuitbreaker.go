package agentshield

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

type CircuitBreaker struct {
	callTracker  map[string][]callRecord
	trippedUntil map[string]int64
	mu           sync.RWMutex
}

type callRecord struct {
	ParamsHash string
	Timestamp  int64
}

func NewCircuitBreaker() *CircuitBreaker {
	return &CircuitBreaker{
		callTracker:  make(map[string][]callRecord),
		trippedUntil: make(map[string]int64),
	}
}

func (cb *CircuitBreaker) Check(sessionKey, toolName string, params map[string]interface{}, config CircuitBreakerConfig) CircuitBreakerResult {
	maxCalls := config.MaxRepeatedCalls
	if maxCalls == 0 {
		maxCalls = 4
	}
	windowMs := config.TimeWindowMs
	if windowMs == 0 {
		windowMs = 10000
	}
	now := time.Now().UnixMilli()

	cb.mu.RLock()
	resetTime := cb.trippedUntil[sessionKey]
	cb.mu.RUnlock()

	if resetTime > 0 && now < resetTime {
		remainingSec := (resetTime - now + 999) / 1000
		return CircuitBreakerResult{
			Tripped: true,
			Reason:  fmt.Sprintf("Circuit Breaker OPEN: Agent loop detected. Aborting tool calls for next %ds.", remainingSec),
		}
	}

	trackerKey := sessionKey + ":" + toolName
	paramsBytes, _ := json.Marshal(params)
	paramsHash := fmt.Sprintf("%x", hashBytes(paramsBytes))

	cb.mu.RLock()
	history := cb.callTracker[trackerKey]
	cb.mu.RUnlock()

	var recent []callRecord
	for _, record := range history {
		if now-record.Timestamp < int64(windowMs) {
			recent = append(recent, record)
		}
	}

	repeatedCount := 0
	for _, record := range recent {
		if record.ParamsHash == paramsHash {
			repeatedCount++
		}
	}

	if repeatedCount >= maxCalls {
		cb.mu.Lock()
		cb.trippedUntil[sessionKey] = now + 30000
		cb.mu.Unlock()
		return CircuitBreakerResult{
			Tripped: true,
			Reason:  fmt.Sprintf("Circuit Breaker TRIPPED: Tool '%s' called %d times with identical parameters within %ds loop.", toolName, repeatedCount+1, windowMs/1000),
		}
	}

	recent = append(recent, callRecord{ParamsHash: paramsHash, Timestamp: now})
	cb.mu.Lock()
	cb.callTracker[trackerKey] = recent
	cb.mu.Unlock()

	return CircuitBreakerResult{Tripped: false}
}

func (cb *CircuitBreaker) Reset(sessionKey string) {
	cb.mu.Lock()
	delete(cb.trippedUntil, sessionKey)
	cb.mu.Unlock()
}

func hashBytes(data []byte) uint64 {
	var hash uint64 = 1469598103934665603
	for _, b := range data {
		hash ^= uint64(b)
		hash *= 1099511628211
	}
	return hash
}

type CircuitBreakerResult struct {
	Tripped bool
	Reason  string
}