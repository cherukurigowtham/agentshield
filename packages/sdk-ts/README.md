# @agentshield/sdk

> Deterministic security, parameter guardrails, and governance OS for autonomous AI agents.

[![npm version](https://img.shields.io/npm/v/@agentshield/sdk.svg)](https://www.npmjs.com/package/@agentshield/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)

AgentShield is a zero-latency interceptor and security wrapper for AI agent tool calls. Prevent runaway agents from executing unauthorized API calls, exceeding spending limits, or falling victim to prompt injections.

---

## 📦 Installation

```bash
npm install @agentshield/sdk
```

---

## ⚡ Quick Start

### 1. Intercept Tool Execution with Guardrails

```typescript
import { AgentShield } from '@agentshield/sdk';

const shield = new AgentShield({
  onViolation: (result, req) => {
    console.error(`[SECURITY ALERT] Tool '${req.toolName}' blocked: ${result.reason}`);
  }
});

// Define your security policy
const policy = {
  allowedTools: ['search_kb', 'transfer_funds'],
  forbiddenTools: ['execute_raw_sql', 'delete_database'],
  maxParamValues: {
    transferAmount: 1000 // Maximum $1,000 per transaction
  },
  forbiddenPatterns: ['DROP TABLE', 'rm -rf', 'GRANT ALL']
};

// Target Tool Function
async function transferFunds(params: { recipient: string; transferAmount: number }) {
  return `Transferred $${params.transferAmount} to ${params.recipient}`;
}

// Wrap tool with AgentShield
const guardedTransfer = await shield.wrapTool('transfer_funds', transferFunds, policy);

// Usage inside your Agent loop:
try {
  // Allowed: $250 transfer
  await guardedTransfer({ recipient: 'Alice', transferAmount: 250 });

  // Blocked: $5,000 transfer (Exceeds $1,000 cap!)
  await guardedTransfer({ recipient: 'Bob', transferAmount: 5000 });
} catch (error) {
  console.log(error.message); // "[AgentShield Blocked] Parameter 'transferAmount' value (5000) exceeds maximum allowed threshold (1000)."
}
```

---

## 🛡️ Policy Options

| Option | Type | Description |
| :--- | :--- | :--- |
| `allowedTools` | `string[]` | Whitelist of permitted tool names. All unlisted tools are blocked. |
| `forbiddenTools` | `string[]` | Blacklist of strictly prohibited tool names. |
| `maxParamValues` | `Record<string, number>` | Numerical thresholds for payload parameters (e.g. amount limits). |
| `forbiddenPatterns` | `(string \| RegExp)[]` | Strings or regex patterns (e.g. SQL injection, CLI commands). |
| `requireApproval` | `boolean` | Requires human-in-the-loop authorization prior to tool execution. |

---

## 📄 License

MIT © 2026 AgentShield Team.
