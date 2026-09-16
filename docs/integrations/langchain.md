# LangChain / LangGraph Integration

```bash
npm install @agentshield/langchain @agentshield/sdk
```

## Wrap Any Tool

```typescript
import { Tool } from '@langchain/core/tools';
import { withAgentShield } from '@agentshield/langchain';

const transferTool = new Tool({
  name: 'transfer_funds',
  description: 'Transfer funds to a recipient',
  schema: z.object({
    recipient: z.string(),
    amount: z.number().positive(),
  }),
  func: async (input) => {
    return `Transferred $${input.amount} to ${input.recipient}`;
  },
});

const shieldedTransfer = withAgentShield(transferTool, {
  policy: {
    allowedTools: ['transfer_funds'],
    maxParamValues: { amount: 1000 },
    enableInjectionSanitizer: true,
  },
  agentId: 'finance-agent-01',
});

// Use exactly like a normal LangChain tool
const result = await shieldedTransfer.call({ recipient: 'Alice', amount: 500 });
```

## LangGraph Middleware

```typescript
import { createAgentShieldMiddleware } from '@agentshield/langchain';
import { StateGraph } from '@langchain/langgraph';

const middleware = createAgentShieldMiddleware({
  policy: {
    allowedTools: ['transfer_funds', 'check_balance'],
    maxParamValues: { amount: 1000 },
  },
  agentId: 'finance-agent',
});

const graph = new StateGraph({ channels: { messages: [] } })
  .addNode('agent', agentNode)
  .addNode('tools', toolNode)
  .addEdge('agent', 'tools')
  // Middleware intercepts ALL tool calls
  .withConfig({ callbacks: [middleware] });
```

## Class-Based Tools

```typescript
import { createShieldedTool } from '@agentshield/langchain';

class TransferFundsTool extends Tool {
  name = 'transfer_funds';
  description = 'Transfer funds';
  schema = z.object({ recipient: z.string(), amount: z.number() });

  async _call(input: { recipient: string; amount: number }) {
    return `Transferred $${input.amount} to ${input.recipient}`;
  }
}

const shielded = createShieldedTool(TransferFundsTool, {
  policy: { maxParamValues: { amount: 1000 } },
});
```

## Configuration

```typescript
interface ShieldedToolConfig {
  policy: GuardrailPolicy;           // Required
  agentId?: string;                  // For audit logs
  sessionId?: string;                // For circuit breaker
  onViolation?: (result, request) => void;  // Custom handler
}
```

## Complete Example

```typescript
import { AgentShield } from '@agentshield/sdk';
import { withAgentShield, createAgentShieldMiddleware } from '@agentshield/langchain';
import { Tool } from '@langchain/core/tools';
import { z } from 'zod';

const policy = {
  allowedTools: ['transfer_funds', 'check_balance', 'search_kb'],
  maxParamValues: { amount: 1000, balance_limit: 10000 },
  forbiddenPatterns: ['DROP TABLE', 'rm -rf', 'IGNORE PREVIOUS'],
  enableInjectionSanitizer: true,
  circuitBreaker: { maxRepeatedCalls: 3, timeWindowMs: 5000 },
};

const tools = [
  withAgentShield(new TransferFundsTool(), { policy, agentId: 'finance-01' }),
  withAgentShield(new CheckBalanceTool(), { policy, agentId: 'finance-01' }),
  withAgentShield(new SearchKBTool(), { policy, agentId: 'finance-01' }),
];

// Or use middleware for LangGraph
const middleware = createAgentShieldMiddleware({ policy, agentId: 'finance-01' });
```