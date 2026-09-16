# AgentShield Policy Packs

Curated, versioned security policy packs for AgentShield. Drop-in compliance for regulated industries.

## Install

```bash
npm install @agentshield/policy-packs
# or
pip install agentshield-policy-packs
```

## Available Packs

| Pack ID | Use Case | Key Protections |
|---------|----------|-----------------|
| `pci-dss-v1` | Fintech, payments | Transaction caps, card data protection, audit trails |
| `hipaa-v1` | Healthcare, telemedicine | PHI access limits, purpose codes, approval gates |
| `no-crypto-v1` | General enterprise | Blocks all crypto/mining/wallet tools & patterns |

## Usage (TypeScript)

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
```

## Usage (Python)

```python
from agentshield import AgentShield
from agentshield_policy_packs import load_policies

policies = load_policies()
hipaa = policies['hipaa-v1']

shield = AgentShield()
result = shield.evaluate('query_patient_records', {'patient_id': '123'}, hipaa)
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

## Contributing

1. Fork & create `policies/my-pack.json`
2. Follow schema at `schemas/guardrail-policy.json`
3. Run `npm run validate`
4. PR with use case description

## Schema

JSON Schema at `dist/guardrail-policy.schema.json` — use in IDE for autocomplete.