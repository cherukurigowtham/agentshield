# Core Concepts

AgentShield is a **deterministic, in-process security layer** that sits between your LLM agent and the tools it calls.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      YOUR AGENT                              │
│  (LangChain, CrewAI, AutoGen, Custom, etc.)                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ Tool Call
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    AGENTSHIELD                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Circuit Breaker      │ Anti death-loop           │   │
│  │ 2. Injection Sanitizer  │ Prompt injection, unicode │   │
│  │ 3. Allow/Block Lists    │ Tool authorization        │   │
│  │ 4. Required Fields      │ Parameter validation      │   │
│  │ 5. Rate Limiting        │ Sliding window (req/min)  │   │
│  │ 6. Budget Caps          │ Session cost limits ($)   │   │
│  │ 7. Param Bounds         │ Max values per parameter  │   │
│  │ 8. Forbidden Patterns   │ Regex-based blocking      │   │
│  │ 9. Approval Gates       │ Human-in-the-loop         │   │
│  │ 10. Timeout             │ Execution deadlines       │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ ALLOW / BLOCK
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL TOOLS                            │
│  (APIs, Databases, Shell, Payments, etc.)                  │
└─────────────────────────────────────────────────────────────┘
```

## Key Properties

| Property | Description |
|----------|-------------|
| **Deterministic** | Same input → same decision, always |
| **Sub-millisecond** | ~0.001ms per evaluation (TypeScript) |
| **In-process** | No network hop, no external dependency |
| **Zero-config** | Works with sensible defaults |
| **Extensible** | Custom policies, webhooks, telemetry |

## Evaluation Pipeline

Each tool call passes through **10 sequential checks**. First failure blocks execution.

```
Tool Call Request
       │
       ▼
┌──────────────────┐
│ Circuit Breaker  │ ──► BLOCK (death-loop detected)
└────────┬─────────┘
         │ PASS
         ▼
┌──────────────────┐
│ Injection Check  │ ──► BLOCK (prompt injection, unicode, base64)
└────────┬─────────┘
         │ PASS
         ▼
┌──────────────────┐
│ Allow/Block List │ ──► BLOCK (unauthorized tool)
└────────┬─────────┘
         │ PASS
         ▼
┌──────────────────┐
│ Required Fields  │ ──► BLOCK (missing params)
└────────┬─────────┘
         │ PASS
         ▼
┌──────────────────┐
│ Rate Limit       │ ──► BLOCK (too many calls/min)
└────────┬─────────┘
         │ PASS
         ▼
┌──────────────────┐
│ Budget Cap       │ ──► BLOCK (session $ limit exceeded)
└────────┬─────────┘
         │ PASS
         ▼
┌──────────────────┐
│ Param Bounds     │ ──► BLOCK (value exceeds max)
└────────┬─────────┘
         │ PASS
         ▼
┌──────────────────┐
│ Forbidden Regex  │ ──► BLOCK (pattern match)
└────────┬─────────┘
         │ PASS
         ▼
┌──────────────────┐
│ Approval Gate    │ ──► REQUIRE_APPROVAL
└────────┬─────────┘
         │ PASS
         ▼
      ALLOW ✅
```

## Remediation Payload

Every blocked call returns actionable guidance:

```json
{
  "allowed": false,
  "reason": "Parameter 'amount' value (5000) exceeds maximum allowed threshold (1000).",
  "actionTaken": "BLOCK",
  "remediation": {
    "status": "REQUIRES_REMEDIATION",
    "suggestedFix": "Reduce 'amount' parameter to <= 1000.",
    "maxAllowedValue": 1000
  }
}
```

Your agent can automatically retry with corrected parameters.

## Audit Trail

Every evaluation produces a cryptographic audit record:

```
Record: rec_1700000000000_abc123
Hash: sha256_a1b2c3d4...
Previous: sha256_00000000...
Chain: GENESIS → ... → current
```

Tamper-evident, SOC2-ready.