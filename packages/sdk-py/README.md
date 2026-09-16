# agentshield

> Deterministic security, parameter guardrails, and governance OS for autonomous AI agents in Python.

[![PyPI version](https://img.shields.io/pypi/v/agentshield.svg)](https://pypi.org/project/agentshield/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)

AgentShield Python SDK lets you protect LangChain, LlamaIndex, AutoGen, and custom Python AI agents with zero-latency decorators and deterministic security rules.

---

## 📦 Installation

```bash
pip install agentshield
```

---

## ⚡ Quick Start

```python
from agentshield import AgentShield, AgentShieldViolation

shield = AgentShield()

# Define security policy
policy = {
    "allowedTools": ["transfer_funds"],
    "maxParamValues": {"amount": 500},
    "forbiddenPatterns": ["DROP TABLE", "rm -rf"]
}

# Wrap python tool with decorator
@shield.guard(tool_name="transfer_funds", policy=policy)
def transfer_funds(recipient: str, amount: float):
    return f"Transferred ${amount} to {recipient}"

# Allowed Call
print(transfer_funds(recipient="Alice", amount=250))

# Blocked Call (Raises AgentShieldViolation)
try:
    transfer_funds(recipient="Bob", amount=2500)
except AgentShieldViolation as e:
    print(e)  # [AgentShield Blocked] Parameter 'amount' value (2500) exceeds max allowed cap (500).
```

---

## 📄 License

MIT © 2026 AgentShield Team.
