import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  AgentShield, 
  AnthropicShieldAdapter, 
  McpShieldAdapter, 
  LangChainShieldAdapter 
} from './index.js';

// ----------------------------------------------------------------------------
// Anthropic Claude Tool Use Adapter Test
// ----------------------------------------------------------------------------
test('Anthropic Claude Tool Use Adapter - Block Malicious Tool Call', () => {
  const adapter = new AnthropicShieldAdapter();
  const policy = { enableInjectionSanitizer: true };

  const contentBlocks = [
    { type: 'text', text: 'Analyzing request...' },
    {
      type: 'tool_use',
      id: 'toolu_01',
      name: 'execute_sql',
      input: { query: 'DROP TABLE users; --' },
    },
  ];

  const { safeBlocks, blockedCalls } = adapter.filterContentBlocks(contentBlocks, policy);
  assert.equal(safeBlocks.length, 1);
  assert.equal(safeBlocks[0].type, 'text');
  assert.equal(blockedCalls.length, 1);
  assert.equal(blockedCalls[0].allowed, false);
});

// ----------------------------------------------------------------------------
// Model Context Protocol (MCP) Adapter Test
// ----------------------------------------------------------------------------
test('MCP Server Middleware Adapter - Guard Tool Execution', async () => {
  const adapter = new McpShieldAdapter();
  const policy = { allowedTools: ['read_file'] };

  const mockHandler = async (name: string, args: Record<string, any>) => {
    return { content: `Read file ${args.path}` };
  };

  const guardedHandler = adapter.wrapMcpHandler(mockHandler, policy);

  // Allowed call
  const validRes = await guardedHandler('read_file', { path: '/tmp/test.txt' });
  assert.equal(validRes.content, 'Read file /tmp/test.txt');

  // Blocked call
  await assert.rejects(
    async () => {
      await guardedHandler('delete_file', { path: '/tmp/test.txt' });
    },
    /Blocked tool execution/
  );
});

// ----------------------------------------------------------------------------
// LangChain / LangGraph Adapter Test
// ----------------------------------------------------------------------------
test('LangChain Tool Adapter - Guard Tool Execution', async () => {
  const adapter = new LangChainShieldAdapter();
  const policy = { maxParamValues: { amount: 100 } };

  const rawTool = {
    name: 'transfer_funds',
    func: async (input: { amount: number }) => `Transferred $${input.amount}`,
  };

  const guardedTool = adapter.wrapTool(rawTool, policy);

  // Allowed call
  const okRes = await guardedTool.func({ amount: 50 });
  assert.equal(okRes, 'Transferred $50');

  // Blocked call (exceeds threshold)
  await assert.rejects(
    async () => {
      await guardedTool.func({ amount: 5000 });
    },
    /Tool 'transfer_funds' execution blocked/
  );
});
