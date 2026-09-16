# Installation

## Package Managers

| Language | Command | Registry |
|----------|---------|----------|
| **TypeScript/Node** | `npm install @agentshield/sdk` | npm |
| **Python** | `pip install agentshield` | PyPI |
| **Go** | `go get github.com/agentshield/sdk-go` | Go Modules |
| **Java** | See below | Maven Central |
| **.NET** | `dotnet add package AgentShield` | NuGet |
| **Rust** | `cargo add agentshield` | crates.io |

## Java (Maven)
```xml
<dependency>
  <groupId>dev.agentshield</groupId>
  <artifactId>agentshield-sdk</artifactId>
  <version>0.1.0</version>
</dependency>
```

## Java (Gradle)
```gradle
implementation 'dev.agentshield:agentshield-sdk:0.1.0'
```

## Framework Integrations

| Framework | Package |
|-----------|---------|
| LangChain / LangGraph | `npm install @agentshield/langchain` |
| CrewAI | `npm install @agentshield/crewai` |
| AutoGen | `npm install @agentshield/autogen` |
| LlamaIndex | `npm install @agentshield/llamaindex` |
| PydanticAI | Built into Python SDK |

## Universal Access (No SDK Needed)

### HTTP Gateway
```bash
# Start gateway
npx @agentshield/gateway
# POST http://localhost:8080/v1/guard
```

### gRPC Gateway
```bash
# Start gRPC server
cd packages/gateway-grpc && ./agentshield-grpc-server
# Connect on :50051
```

### CLI
```bash
npm install -g @agentshield/cli
agentshield eval -t transfer_funds -p '{"amount": 5000}' -P policy.json
```

## Requirements

| Runtime | Minimum Version |
|---------|-----------------|
| Node.js | 18+ |
| Python | 3.10+ |
| Go | 1.22+ |
| Java | 17+ |
| .NET | 8.0+ |
| Rust | 1.70+ |

## Verification

```bash
# Test installation
agentshield test-injection
# Should show 9/9 attacks blocked
```