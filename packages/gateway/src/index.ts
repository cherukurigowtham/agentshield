import Fastify from 'fastify';
import { AgentShield, GuardrailPolicy, ToolCallRequest, EvaluationResult } from '@agentshield/sdk';

interface GuardRequest {
  toolName: string;
  params: Record<string, any>;
  agentId?: string;
  sessionId?: string;
  policy: GuardrailPolicy;
  estimatedCost?: number;
}

interface GuardResponse {
  allowed: boolean;
  reason?: string;
  actionTaken: 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL' | 'CIRCUIT_TRIPPED';
  timestamp: string;
  remediation?: {
    status: 'BLOCKED' | 'REQUIRES_REMEDIATION';
    suggestedFix?: string;
    maxAllowedValue?: number;
  };
}

interface PolicyStoreRequest {
  id: string;
  policy: GuardrailPolicy;
}

interface BatchGuardRequest {
  requests: GuardRequest[];
}

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
});

const shield = new AgentShield();
const policyStore = new Map<string, GuardrailPolicy>();

fastify.post<{ Body: GuardRequest }>('/v1/guard', async (request, reply) => {
  const { toolName, params, agentId, sessionId, policy, estimatedCost } = request.body;

  if (!toolName || !params || !policy) {
    return reply.code(400).send({
      error: 'Missing required fields: toolName, params, policy',
    });
  }

  const evalRequest: ToolCallRequest = {
    toolName,
    params,
    agentId,
    sessionId,
    estimatedCost,
  };

  const result: EvaluationResult = shield.guard(evalRequest, policy);

  const response: GuardResponse = {
    allowed: result.allowed,
    reason: result.reason,
    actionTaken: result.actionTaken,
    timestamp: result.timestamp,
    remediation: result.remediation,
  };

  if (!result.allowed) {
    return reply.code(403).send(response);
  }

  return reply.send(response);
});

fastify.post<{ Body: BatchGuardRequest }>('/v1/guard/batch', async (request, reply) => {
  const { requests } = request.body;

  if (!requests || !Array.isArray(requests)) {
    return reply.code(400).send({ error: 'requests array required' });
  }

  const results = requests.map(({ toolName, params, agentId, sessionId, policy, estimatedCost }) => {
    const evalRequest: ToolCallRequest = { toolName, params, agentId, sessionId, estimatedCost };
    const result = shield.guard(evalRequest, policy);
    return {
      toolName,
      allowed: result.allowed,
      reason: result.reason,
      actionTaken: result.actionTaken,
      timestamp: result.timestamp,
      remediation: result.remediation,
    };
  });

  return reply.send({ results });
});

fastify.post<{ Body: PolicyStoreRequest }>('/v1/policies', async (request, reply) => {
  const { id, policy } = request.body;

  if (!id || !policy) {
    return reply.code(400).send({ error: 'Missing id or policy' });
  }

  policyStore.set(id, policy);
  return reply.send({ id, stored: true });
});

fastify.get<{ Params: { id: string } }>('/v1/policies/:id', async (request, reply) => {
  const policy = policyStore.get(request.params.id);
  if (!policy) {
    return reply.code(404).send({ error: 'Policy not found' });
  }
  return reply.send(policy);
});

fastify.delete<{ Params: { id: string } }>('/v1/policies/:id', async (request, reply) => {
  const deleted = policyStore.delete(request.params.id);
  return reply.send({ deleted });
});

fastify.get('/v1/policies', async () => {
  return { policies: Array.from(policyStore.keys()) };
});

fastify.get('/health', async () => {
  return { status: 'ok', version: '0.1.0' };
});

fastify.get('/v1/schema', async () => {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'https://agentshield.dev/schemas/guardrail-policy.json',
    title: 'AgentShield Guardrail Policy',
    type: 'object',
    properties: {
      allowedTools: { type: 'array', items: { type: 'string' } },
      forbiddenTools: { type: 'array', items: { type: 'string' } },
      maxParamValues: { type: 'object', additionalProperties: { type: 'number' } },
      forbiddenPatterns: { type: 'array', items: { type: 'string' } },
      requiredFields: { type: 'array', items: { type: 'string' } },
      rateLimit: { type: 'object', properties: { maxCallsPerMinute: { type: 'integer' } } },
      maxCostPerSession: { type: 'number' },
      circuitBreaker: {
        type: 'object',
        properties: {
          maxRepeatedCalls: { type: 'integer' },
          timeWindowMs: { type: 'integer' },
        },
      },
      enableInjectionSanitizer: { type: 'boolean' },
      timeoutMs: { type: 'integer' },
      requireApproval: { type: 'boolean' },
    },
  };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '8080', 10);
    const host = process.env.HOST || '0.0.0.0';
    await fastify.listen({ port, host });
    console.log(`🛡️ AgentShield Gateway running on http://${host}:${port}`);
    console.log(`   POST   /v1/guard          - Evaluate single tool call`);
    console.log(`   POST   /v1/guard/batch    - Evaluate multiple tool calls`);
    console.log(`   POST   /v1/policies       - Store policy`);
    console.log(`   GET    /v1/policies/:id   - Retrieve policy`);
    console.log(`   GET    /v1/schema         - JSON schema for policies`);
    console.log(`   GET    /health            - Health check`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();