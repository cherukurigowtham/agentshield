import { Tool } from '@langchain/core/tools';
import { z } from 'zod';
import { withAgentShield, ShieldedToolConfig } from './index';

const transferSchema = z.object({
  recipient: z.string(),
  amount: z.number().positive(),
});

class TransferFundsTool extends Tool {
  name = 'transfer_funds';
  description = 'Transfer funds to a recipient';
  schema = transferSchema;

  async _call(input: z.infer<typeof transferSchema>): Promise<string> {
    return `Transferred $${input.amount} to ${input.recipient}`;
  }
}

const policy: ShieldedToolConfig['policy'] = {
  allowedTools: ['transfer_funds'],
  maxParamValues: { amount: 1000 },
  forbiddenPatterns: ['DROP TABLE', 'rm -rf', 'IGNORE PREVIOUS INSTRUCTIONS'],
  enableInjectionSanitizer: true,
};

const shieldedTransfer = withAgentShield(new TransferFundsTool(), {
  policy,
  agentId: 'finance-agent-01',
  sessionId: 'session-123',
  onViolation: (result, request) => {
    console.log(`[VIOLATION] ${request.toolName}: ${result.reason}`);
  },
});

async function demo() {
  console.log('Testing allowed transfer...');
  const allowed = await shieldedTransfer.call({ recipient: 'Alice', amount: 500 });
  console.log('✅', allowed);

  console.log('\nTesting blocked transfer (over limit)...');
  try {
    await shieldedTransfer.call({ recipient: 'Bob', amount: 5000 });
  } catch (e: any) {
    console.log('❌ Blocked:', e.message);
  }

  console.log('\nTesting injection attack...');
  try {
    await shieldedTransfer.call({ 
      recipient: 'Attacker', 
      amount: 100 
    });
  } catch (e: any) {
    console.log('❌ Blocked:', e.message);
  }
}

demo();