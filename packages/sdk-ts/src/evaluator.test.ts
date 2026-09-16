import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentShield } from './guard.js';

test('AgentShield - Tool Whitelist Enforcement', () => {
  const shield = new AgentShield();
  const policy = { allowedTools: ['search_kb', 'read_docs'] };

  const validCall = shield.guard({ toolName: 'search_kb', params: {} }, policy);
  assert.equal(validCall.allowed, true);

  const invalidCall = shield.guard({ toolName: 'execute_sql', params: {} }, policy);
  assert.equal(invalidCall.allowed, false);
  assert.match(invalidCall.reason!, /not in the allowed tools/);
});

test('AgentShield - Parameter Bound Limit', () => {
  const shield = new AgentShield();
  const policy = { maxParamValues: { amount: 500 } };

  const validTransfer = shield.guard({ toolName: 'transfer_funds', params: { amount: 100 } }, policy);
  assert.equal(validTransfer.allowed, true);

  const excessiveTransfer = shield.guard({ toolName: 'transfer_funds', params: { amount: 50000 } }, policy);
  assert.equal(excessiveTransfer.allowed, false);
  assert.match(excessiveTransfer.reason!, /exceeds maximum allowed threshold/);
});

test('AgentShield - Destructive Injection Pattern Defense', () => {
  const shield = new AgentShield();
  const policy = { forbiddenPatterns: ['DROP TABLE', 'rm -rf', 'IGNORE ALL PREVIOUS INSTRUCTIONS'] };

  const maliciousPayload = shield.guard(
    { toolName: 'query_db', params: { query: 'SELECT * FROM users; DROP TABLE users;' } },
    policy
  );
  assert.equal(maliciousPayload.allowed, false);
  assert.match(maliciousPayload.reason!, /matched forbidden injection pattern/);
});

test('AgentShield - Required Fields Verification', () => {
  const shield = new AgentShield();
  const policy = { requiredFields: ['recipient', 'amount'] };

  const validCall = shield.guard({ toolName: 'pay', params: { recipient: 'Alice', amount: 50 } }, policy);
  assert.equal(validCall.allowed, true);

  const missingFieldCall = shield.guard({ toolName: 'pay', params: { amount: 50 } }, policy);
  assert.equal(missingFieldCall.allowed, false);
  assert.match(missingFieldCall.reason!, /Missing required parameter field 'recipient'/);
});

test('AgentShield - Base64 Encoded Injection Payload Defense', () => {
  const shield = new AgentShield();
  const policy = { forbiddenPatterns: ['DROP TABLE'] };
  
  // "DROP TABLE" encoded in Base64 is "RFJPUCBUQUJMRQ=="
  const base64EncodedPayload = shield.guard(
    { toolName: 'query_db', params: { payload: 'RFJPUCBUQUJMRQ==' } },
    policy
  );
  assert.equal(base64EncodedPayload.allowed, false);
  assert.match(base64EncodedPayload.reason!, /Base64 decoded payload matched forbidden pattern/);
});

test('AgentShield - Execution Timeout Interceptor', async () => {
  const shield = new AgentShield();
  const policy = { timeoutMs: 50 };

  const slowTool = async () => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return 'Done';
  };

  const guardedSlowTool = await shield.wrapTool('slow_tool', slowTool, policy);

  await assert.rejects(
    async () => {
      await guardedSlowTool({});
    },
    /Execution timed out after 50ms/
  );
});
