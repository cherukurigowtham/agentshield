# 🛡️ AgentShield

### Deterministic Security, Guardrails & Governance OS for Autonomous AI Agents

AgentShield is an open-source, zero-latency security platform built to protect enterprise infrastructure from rogue AI agent actions, prompt injections, payload tampering, and runaway budget execution.

---

## 🌟 Key Capabilities

* ⚡ **Zero-Latency Policy Evaluation**: In-process interception of tool calls before external APIs execute.
* 🛑 **Financial & Parameter Bounds**: Hard caps on financial transactions, query sizes, and API limits.
* 🔐 **Prompt Injection Shield**: Regex & AST-based detection of destructive SQL (`DROP TABLE`), shell commands (`rm -rf`), and prompt overrides.
* 📊 **Real-Time Telemetry Control Plane**: Built-in Next.js 14 dashboard for live audit feeds and policy management.
* 🌐 **Multi-Language SDKs**: First-class support for TypeScript (`npm install @agentshield/sdk`) and Python (`pip install agentshield`).

---

## 🏗️ Repository Architecture

```
.
├── packages/
│   ├── sdk-ts/        # @agentshield/sdk (npm package)
│   └── sdk-py/        # agentshield (PyPI package)
├── apps/
│   └── dashboard/     # Next.js 14 Web Security Control Plane
└── examples/
    └── demo-agent.ts  # Node.js Security Interception Demo
```

---

## 🚀 Quick Launch

### 1. Run Node.js Live Demo
```bash
npx tsx examples/demo-agent.ts
```

### 2. Run Next.js Security Dashboard
```bash
npm --prefix apps/dashboard run dev
# Open http://localhost:3000
```

### 3. Run Test Suites
```bash
# TypeScript SDK Tests
npm --prefix packages/sdk-ts run test

# Python SDK Tests
PYTHONPATH=packages/sdk-py python3 packages/sdk-py/test_agentshield.py
```

---

## 📄 License
MIT © 2026 AgentShield Team.
