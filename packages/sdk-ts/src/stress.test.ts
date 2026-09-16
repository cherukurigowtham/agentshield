import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  AgentShield, PolicyEvaluator, InjectionSanitizer, CircuitBreaker,
  BloomFilterGuard, ASTSandboxEngine, AgentDependencyGraph 
} from './index.js';

// -------------------------------------------------------------
// LEVEL 1: Boundary & Edge-Case Input Testing
// -------------------------------------------------------------
test('Enterprise Test Level 1 - Boundary & Edge-Case Input Testing', () => {
  const shield = new AgentShield();
  const policy = {
    maxParamValues: { amount: 1000 },
    requiredFields: ['recipient'],
    forbiddenPatterns: ['DROP TABLE'],
  };

  const negativeCall = shield.guard({ toolName: 'pay', params: { recipient: 'Alice', amount: -50 } }, policy);
  assert.equal(negativeCall.allowed, true);

  const boundaryCall = shield.guard({ toolName: 'pay', params: { recipient: 'Alice', amount: 1000 } }, policy);
  assert.equal(boundaryCall.allowed, true);

  const overBoundaryCall = shield.guard({ toolName: 'pay', params: { recipient: 'Alice', amount: 1000.01 } }, policy);
  assert.equal(overBoundaryCall.allowed, false);
});

// -------------------------------------------------------------
// LEVEL 2: AST Lexical Tokenizer & String Concatenation Exploits
// -------------------------------------------------------------
test('Enterprise Test Level 2 - AST Lexical Analysis & Concatenation Exploit Defense', () => {
  // Concatenated string exploit: "DRO" + "P TAB" + "LE"
  const concatenatedCode = 'const query = "DRO" + "P TAB" + "LE users;"';
  const astRes1 = ASTSandboxEngine.analyzeCodePayload(concatenatedCode);
  assert.equal(astRes1.dangerous, true);
  assert.match(astRes1.reason!, /detected obfuscated concatenated command/);

  // Dynamic function evaluation exploit: eval("safe_function()")
  const dynamicEvalCode = 'eval("safe_function()")';
  const astRes2 = ASTSandboxEngine.analyzeCodePayload(dynamicEvalCode);
  assert.equal(astRes2.dangerous, true);
  assert.match(astRes2.reason!, /detected forbidden dynamic function invocation/);
});

// -------------------------------------------------------------
// LEVEL 3: Bloom Filter O(1) Fast-Path Threat Pre-Filter
// -------------------------------------------------------------
test('Enterprise Test Level 3 - Probabilistic Bloom Filter Fast-Path Pre-Filter', () => {
  const filter = new BloomFilterGuard(1024, 3);
  filter.add('DROP TABLE');

  assert.equal(filter.mightContain('DROP TABLE'), true);
  assert.equal(filter.mightContain('SAFE_READ_TOOL'), false);
});

// -------------------------------------------------------------
// LEVEL 4: Multi-Agent DAG Workflow & Sequence Validation
// -------------------------------------------------------------
test('Enterprise Test Level 4 - Multi-Agent Workflow DAG Sequence Validation', () => {
  const dag = new AgentDependencyGraph();

  // Register DAG: ScraperAgent -> AnalyzerAgent -> ExecutorAgent
  dag.registerStep({ agentId: 'ScraperAgent', allowedNextAgents: ['AnalyzerAgent'], allowedTools: ['fetch_web'] });
  dag.registerStep({ agentId: 'AnalyzerAgent', allowedNextAgents: ['ExecutorAgent'], allowedTools: ['summarize'] });
  dag.registerStep({ agentId: 'ExecutorAgent', allowedTools: ['execute_trade'] });

  const session = 'workflow-session-101';

  // 1. ScraperAgent runs fetch_web (Valid)
  const step1 = dag.validateTransition(session, 'ScraperAgent', 'fetch_web');
  assert.equal(step1.valid, true);

  // 2. AnalyzerAgent runs summarize after ScraperAgent (Valid)
  const step2 = dag.validateTransition(session, 'AnalyzerAgent', 'summarize');
  assert.equal(step2.valid, true);

  // 3. ScraperAgent attempts to bypass AnalyzerAgent and execute trade directly (INVALID DAG TRANSITION!)
  const invalidTransition = dag.validateTransition(session, 'ScraperAgent', 'execute_trade');
  assert.equal(invalidTransition.valid, false);
  assert.match(invalidTransition.reason!, /Multi-Agent DAG Sequence Violation/);
});

// -------------------------------------------------------------
// LEVEL 5: Sub-Millisecond Performance & Latency Benchmark
// -------------------------------------------------------------
test('Enterprise Test Level 5 - Sub-Millisecond Performance & Latency Benchmark', () => {
  const shield = new AgentShield();
  const policy = {
    allowedTools: ['benchmark_tool'],
    maxParamValues: { val: 1000 },
    enableInjectionSanitizer: true,
  };

  const iterations = 5000;
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    shield.guard({ toolName: 'benchmark_tool', params: { val: 500 } }, policy);
  }

  const totalTime = performance.now() - startTime;
  const avgLatencyMs = totalTime / iterations;

  console.log(`\n  ⚡ Benchmark: ${iterations} evaluations in ${totalTime.toFixed(2)}ms (Avg: ${avgLatencyMs.toFixed(4)}ms/eval)`);
  assert.ok(avgLatencyMs < 1.0, `Average latency must be < 1.0ms, got ${avgLatencyMs}ms`);
});
