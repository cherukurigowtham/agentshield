# Policy Packs

Pre-built, versioned compliance policies. Drop in and go.

## Available Packs

| Pack | ID | Use Case | Key Protections |
|------|-----|----------|-----------------|
| **PCI-DSS** | `pci-dss-v1` | Fintech, payments | $10k txn cap, card data protection, audit trails |
| **HIPAA** | `hipaa-v1` | Healthcare | PHI access limits, purpose codes, approval gates |
| **No-Crypto** | `no-crypto-v1` | Enterprise | Blocks all crypto/mining/wallet tools & patterns |

## Installation

```bash
npm install @agentshield/policy-packs
# or
pip install agentshield-policy-packs
```

## Usage

### TypeScript
```typescript
import { loadAllPolicies } from '@agentshield/policy-packs';
import { AgentShield } from '@agentshield/sdk';

const policies = loadAllPolicies();
const pciPolicy = policies.get('pci-dss-v1');

const shield = new AgentShield();
const result = shield.guard(
  { toolName: 'transfer_funds', params: { amount: 5000 } },
  pciPolicy
);
// BLOCKED: exceeds $10k cap
```

### Python
```python
from agentshield import AgentShield
from agentshield_policy_packs import load_policies

policies = load_policies()
hipaa = policies['hipaa-v1']

shield = AgentShield()
result = shield.evaluate('query_patient_records', {'patient_id': '123'}, hipaa)
```

### Go
```go
import "github.com/agentshield/policy-packs"

policies := policy.LoadAllPolicies()
pciPolicy := policies["pci-dss-v1"]

shield := agentshield.New(agentshield.AgentShieldConfig{})
result := shield.Guard(agentshield.ToolCallRequest{
    ToolName: "transfer_funds",
    Params: map[string]interface{}{"amount": 5000},
}, pciPolicy)
```

## Custom Policies

Extend any pack:

```json
{
  "$schema": "https://agentshield.dev/schemas/guardrail-policy.json",
  "id": "my-company-pci-v1",
  "name": "Acme Corp PCI-DSS Extended",
  "version": "1.0.0",
  "extends": "pci-dss-v1",
  "maxParamValues": {
    "amount": 5000
  }
}
```

## Policy Schema

Full JSON Schema at `https://agentshield.dev/schemas/guardrail-policy.json` — use in VS Code for autocomplete and validation.

```json
{
  "allowedTools": ["string"],
  "forbiddenTools": ["string"],
  "maxParamValues": { "paramName": 1000 },
  "forbiddenPatterns": ["regex"],
  "requiredFields": ["fieldName"],
  "rateLimit": { "maxCallsPerMinute": 30 },
  "maxCostPerSession": 50000,
  "circuitBreaker": { "maxRepeatedCalls": 3, "timeWindowMs": 5000 },
  "enableInjectionSanitizer": true,
  "timeoutMs": 30000,
  "requireApproval": false,
  "webhookUrl": "https://..."
}
```

## Contributing

1. Fork & create `policies/my-pack.json`
2. Follow schema at `schemas/guardrail-policy.json`
3. Run `npm run validate` in `packages/policy-packs`
4. PR with use case description