import { AgentShield } from '../packages/sdk-ts/dist/index.js';

async function runDemoAgent() {
  console.log('=== AgentShield: AI Agent Security & Guardrail Demo ===\n');

  const shield = new AgentShield({
    onViolation: (result, req) => {
      console.log(`\x1b[31m[VIOLATION DETECTED]\x1b[0m Tool: ${req.toolName} | Reason: ${result.reason}`);
    },
  });

  const securityPolicy = {
    allowedTools: ['search_database', 'send_user_notification', 'transfer_funds'],
    forbiddenTools: ['execute_raw_sql', 'delete_account'],
    maxParamValues: {
      transferAmount: 1000, // Maximum $1,000 transfer per transaction
    },
    forbiddenPatterns: ['DROP TABLE', 'DELETE FROM', 'rm -rf', 'GRANT ALL'],
  };

  // Mock Agent Tools
  const transferFunds = async (params: { recipient: string; transferAmount: number }) => {
    return `Successfully transferred $${params.transferAmount} to ${params.recipient}`;
  };

  const guardedTransfer = await shield.wrapTool('transfer_funds', transferFunds, securityPolicy);

  // Test Case 1: Valid Execution ($250 transfer)
  console.log('--> Scenario 1: Agent attempts valid $250 transfer...');
  try {
    const res = await guardedTransfer({ recipient: 'Alice', transferAmount: 250 });
    console.log(`\x1b[32m[ALLOWED]\x1b[0m ${res}\n`);
  } catch (err: any) {
    console.error(err.message);
  }

  // Test Case 2: Parameter Threshold Breach ($5,000 transfer attempt)
  console.log('--> Scenario 2: Agent attempts excessive $5,000 transfer...');
  try {
    await guardedTransfer({ recipient: 'Unknown Account', transferAmount: 5000 });
  } catch (err: any) {
    console.log(`\x1b[33m[BLOCKED]\x1b[0m ${err.message}\n`);
  }

  // Test Case 3: Prompt Injection / Destructive SQL Payload
  console.log('--> Scenario 3: Agent payload contains malicious SQL injection pattern...');
  const queryDb = async (params: { query: string }) => params.query;
  const guardedQuery = await shield.wrapTool('query_db', queryDb, securityPolicy);

  try {
    await guardedQuery({ query: 'SELECT * FROM products; DROP TABLE users;' });
  } catch (err: any) {
    console.log(`\x1b[33m[BLOCKED]\x1b[0m ${err.message}\n`);
  }

  console.log('=== Demo Complete ===');
}

runDemoAgent();
