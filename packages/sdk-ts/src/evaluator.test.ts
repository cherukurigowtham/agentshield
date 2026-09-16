import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentShield } from './guard.js';
import { OpenAIAdapter } from './adapters/openai.js';
import { AuditExporter } from './audit.js';

test('AgentShield - Tool Whitelist Enforcement', () => {
  const shield = new AgentShield();
  const policy = { allowedTools: ['search_kb', 'read_docs'] };

  const validCall = shield.guard({ toolName: 'search_kb', params: {} }, policy);
  assert.equal(validCall.allowed, true);

  const invalidCall = shield.guard({ toolName: 'execute_sql', params: {} }, policy);
  assert.equal(invalidCall.allowed, false);
  assert.match(invalidCall.reason!, /not in the allowed tools/);
});

test('AgentShield - Parameter Bound Limit & Remediation Payload', () => {
  const shield = new AgentShield();
  const policy = { maxParamValues: { amount: 500 } };

  const validTransfer = shield.guard({ toolName: 'transfer_funds', params: { amount: 100 } }, policy);
  assert.equal(validTransfer.allowed, true);

  const excessiveTransfer = shield.guard({ toolName: 'transfer_funds', params: { amount: 50000 } }, policy);
  assert.equal(excessiveTransfer.allowed, false);
  assert.equal(excessiveTransfer.remediation?.status, 'REQUIRES_REMEDIATION');
  assert.equal(excessiveTransfer.remediation?.maxAllowedValue, 500);
});

test('AgentShield - OpenAI Function Calling Adapter', () => {
  const adapter = new OpenAIAdapter();
  const policies = {
    transfer_funds: { maxParamValues: { amount: 1000 } }
  };

  const sampleToolCalls = [
    {
      id: 'call_1',
      type: 'function' as const,
      function: { name: 'transfer_funds', arguments: '{"amount": 250}' }
    },
    {
      id: 'call_2',
      type: 'function' as const,
      function: { name: 'transfer_funds', arguments: '{"amount": 9999}' }
    }
  ];

  const result = adapter.validateToolCalls(sampleToolCalls, policies);
  assert.equal(result.validToolCalls.length, 1);
  assert.equal(result.blockedToolCalls.length, 1);
  assert.equal(result.validToolCalls[0].id, 'call_1');
  assert.equal(result.blockedToolCalls[0].toolCall.id, 'call_2');
});

test('AgentShield - Cryptographic SOC2 Audit Exporter', () => {
  const exporter = new AuditExporter();
  const req = { toolName: 'transfer_funds', params: { amount: 100, password: 'secret_pass' }, agentId: 'agent-99' };
  const res = { allowed: true, actionTaken: 'ALLOW' as const, timestamp: new Date().toISOString() };

  const record = exporter.createRecord(req, res);
  assert.ok(record.recordId);
  assert.ok(record.hash);
  assert.equal(record.paramsSanitized.password, '***MASKED***');

  const soc2Log = exporter.exportSOC2Log();
  assert.match(soc2Log, /AgentShield-Audit-v1/);
});

test('AgentShield - Circuit Breaker Death Loop Interceptor', () => {
  const shield = new AgentShield();
  const policy = {
    circuitBreaker: { maxRepeatedCalls: 3, timeWindowMs: 5000 }
  };

  const req = { toolName: 'retry_payment', params: { orderId: '123' }, sessionId: 'test-session' };

  assert.equal(shield.guard(req, policy).allowed, true);
  assert.equal(shield.guard(req, policy).allowed, true);
  assert.equal(shield.guard(req, policy).allowed, true);

  const trippedRes = shield.guard(req, policy);
  assert.equal(trippedRes.allowed, false);
  assert.equal(trippedRes.actionTaken, 'CIRCUIT_TRIPPED');
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
