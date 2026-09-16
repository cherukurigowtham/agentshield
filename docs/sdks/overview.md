# SDK Overview

AgentShield provides **native SDKs for 6 languages** with full feature parity.

## Feature Matrix

| Feature | TypeScript | Python | Go | Java | .NET | Rust |
|---------|------------|--------|----|------|------|------|
| Tool allow/block lists | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Parameter bounds + remediation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rate limiting (sliding window) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Circuit breaker (death-loop) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Financial budget caps | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Injection sanitizer (9 types) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Required fields | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Forbidden patterns (regex) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approval gates | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Execution timeout | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Webhook/telemetry hooks | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| OpenAI function calling adapter | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cryptographic audit log (SOC2) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Tests** | 11/11 | 6/6 | 7/7 | 6/6 | — | — |

## Quick Comparison

### TypeScript (Fastest, Most Features)
```typescript
import { AgentShield, shield } from '@agentshield/sdk';

// 1-liner for simple cases
const safeFn = shield('transfer', transferFn, { maxParamValues: { amount: 1000 } });

// Full control
const shield = new AgentShield({ onViolation: logViolation });
const result = shield.guard({ toolName: 'transfer', params: { amount: 500 } }, policy);
```

### Python (Decorator-Based)
```python
from agentshield import AgentShield

shield = AgentShield()

@shield.guard(tool_name="transfer", policy={"maxParamValues": {"amount": 1000}})
async def transfer(recipient: str, amount: float):
    return "OK"

# Async + timeout
@shield.aguard(tool_name="transfer", policy={"timeoutSeconds": 5})
async def transfer(...): ...
```

### Go (Concurrency-Safe)
```go
shield := agentshield.New(agentshield.AgentShieldConfig{
    OnViolation: func(r agentshield.EvaluationResult, req agentshield.ToolCallRequest) {
        log.Printf("ALERT: %s - %s", req.ToolName, r.Reason)
    },
})

result := shield.Guard(agentshield.ToolCallRequest{
    ToolName: "transfer",
    Params: map[string]interface{}{"amount": 500},
}, policy)
```

### Java (Builder Pattern)
```java
AgentShield shield = new AgentShield(new AgentShieldConfig() {{
    setOnViolation((result, request) -> log.warn("{} - {}", request.getToolName(), result.getReason()));
}});

GuardrailPolicy policy = new GuardrailPolicy();
policy.setMaxParamValues(Map.of("amount", 1000.0));

EvaluationResult result = shield.guard(
    new ToolCallRequest("transfer", Map.of("amount", 500)),
    policy
);
```

### .NET (Async/Await Native)
```csharp
var shield = new AgentShield(new AgentShieldConfig
{
    OnViolation = (result, request) => Log.Warning($"{request.ToolName} - {result.Reason}")
});

var policy = new GuardrailPolicy
{
    MaxParamValues = new Dictionary<string, double> { ["amount"] = 1000 }
};

var result = shield.Guard(new ToolCallRequest("transfer", new Dictionary<string, object>
{
    ["amount"] = 500
}), policy);

// Wrap with timeout
var safeTransfer = shield.WrapTool("transfer", async (params) => await DoTransfer(params), policy);
```

### Rust (Zero-Cost Abstractions)
```rust
use agentshield::{AgentShield, GuardrailPolicy, ToolCallRequest};

let shield = AgentShield::new(AgentShieldConfig {
    on_violation: Some(Box::new(|result, request| {
        eprintln!("ALERT: {} - {}", request.tool_name, result.reason.unwrap_or_default());
    })),
    ..Default::default()
});

let policy = GuardrailPolicy {
    max_param_values: Some(HashMap::from([("amount".to_string(), 1000.0)])),
    enable_injection_sanitizer: Some(true),
    ..Default::default()
};

let result = shield.guard(ToolCallRequest {
    tool_name: "transfer".to_string(),
    params: HashMap::from([("amount".to_string(), json!(500))]),
    ..Default::default()
}, policy);
```

## Universal Access (No SDK Required)

| Method | Use Case |
|--------|----------|
| **HTTP Gateway** | Any language, serverless, edge |
| **gRPC Gateway** | High-performance, polyglot microservices |
| **CLI** | CI/CD, testing, ad-hoc evaluation |

```bash
# HTTP
curl -X POST http://localhost:8080/v1/guard \
  -d '{"toolName":"transfer","params":{"amount":5000},"policy":{"maxParamValues":{"amount":1000}}}'

# gRPC (from any language with protobuf)
# CLI
agentshield eval -t transfer -p '{"amount":5000}' -P policy.json
```

## Choose Your SDK

| If you're building... | Use |
|----------------------|-----|
| Node.js/TypeScript app | `@agentshield/sdk` |
| Python AI/ML pipeline | `pip install agentshield` |
| Go microservice | `github.com/agentshield/sdk-go` |
| Java enterprise app | `dev.agentshield:agentshield-sdk` |
| .NET/C# service | `AgentShield` NuGet |
| Rust high-perf system | `agentshield` crate |
| LangChain/LangGraph | `@agentshield/langchain` |
| CrewAI | `@agentshield/crewai` |
| AutoGen | `@agentshield/autogen` |
| LlamaIndex | `@agentshield/llamaindex` |

All SDKs share the **same policy schema** — portable across languages.