import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { AgentShield, GuardrailPolicy, ToolCallRequest, EvaluationResult } from '@agentshield/sdk';
import crypto from 'node:crypto';

export interface TenantAccount {
  tenantId: string;
  key: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  monthlyQuota: number;
  usageCount: number;
  createdAt: string;
}

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
  tenantId: string;
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

interface ProvisionKeyRequest {
  name: string;
  plan?: 'free' | 'pro' | 'enterprise';
}

// Extend FastifyRequest type to include tenant
declare module 'fastify' {
  interface FastifyRequest {
    tenant?: TenantAccount;
  }
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

// Isolated Multi-Tenant In-Memory Stores
const tenantKeys = new Map<string, TenantAccount>();
const tenantPolicyStore = new Map<string, GuardrailPolicy>();

// Seed default demo key for immediate developer testing
const demoTenant: TenantAccount = {
  tenantId: 'tenant_demo_001',
  key: 'ag_live_demo_key_12345',
  name: 'Developer Demo Workspace',
  plan: 'free',
  monthlyQuota: 100000,
  usageCount: 0,
  createdAt: new Date().toISOString(),
};
tenantKeys.set(demoTenant.key, demoTenant);

// Multi-Tenant Authentication & Usage Quota Pre-Handler
fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
  // Exclude health check and open schema routes from auth requirement
  if (request.url === '/health' || request.url === '/v1/schema' || request.url === '/v1/auth/keys') {
    return;
  }

  const apiKeyHeader = request.headers['x-api-key'] || request.headers['authorization'];
  let rawKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
  if (rawKey && rawKey.startsWith('Bearer ')) {
    rawKey = rawKey.substring(7);
  }

  if (!rawKey) {
    // If no key provided, default to demo tenant for zero-friction local testing
    request.tenant = demoTenant;
    return;
  }

  const tenant = tenantKeys.get(rawKey);
  if (!tenant) {
    return reply.code(401).send({
      error: 'Unauthorized: Invalid API key provided in x-api-key header.',
    });
  }

  // Quota enforcement check
  if (tenant.usageCount >= tenant.monthlyQuota && tenant.plan !== 'enterprise') {
    return reply.code(429).send({
      error: `Monthly API quota limit reached (${tenant.usageCount}/${tenant.monthlyQuota}). Upgrade to Pro or Enterprise plan.`,
      tenantId: tenant.tenantId,
      plan: tenant.plan,
    });
  }

  request.tenant = tenant;
});

// 1. Provision New Isolated API Key
fastify.post<{ Body: ProvisionKeyRequest }>('/v1/auth/keys', async (request, reply) => {
  const { name, plan = 'free' } = request.body || {};

  if (!name) {
    return reply.code(400).send({ error: 'Missing account name parameter' });
  }

  const tenantId = `tenant_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const key = `ag_live_${crypto.randomBytes(16).toString('hex')}`;
  
  const quotas: Record<string, number> = {
    free: 10000,
    pro: 1000000,
    enterprise: 100000000,
  };

  const newTenant: TenantAccount = {
    tenantId,
    key,
    name,
    plan,
    monthlyQuota: quotas[plan] || 10000,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  };

  tenantKeys.set(key, newTenant);

  return reply.send({
    message: 'API key provisioned successfully',
    tenantId,
    apiKey: key,
    plan,
    monthlyQuota: newTenant.monthlyQuota,
  });
});

// 2. Retrieve Tenant API Usage Metrics
fastify.get('/v1/auth/usage', async (request, reply) => {
  const tenant = request.tenant;
  if (!tenant) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  return reply.send({
    tenantId: tenant.tenantId,
    name: tenant.name,
    plan: tenant.plan,
    usageCount: tenant.usageCount,
    monthlyQuota: tenant.monthlyQuota,
    remainingQuota: Math.max(0, tenant.monthlyQuota - tenant.usageCount),
  });
});

// 3. Evaluate Single Tool Call (Tenant Isolated)
fastify.post<{ Body: GuardRequest }>('/v1/guard', async (request, reply) => {
  const tenant = request.tenant!;
  const { toolName, params, agentId, sessionId, policy, estimatedCost } = request.body;

  if (!toolName || !params || !policy) {
    return reply.code(400).send({
      error: 'Missing required fields: toolName, params, policy',
    });
  }

  const evalRequest: ToolCallRequest = {
    toolName,
    params,
    agentId: agentId || `${tenant.tenantId}-agent`,
    sessionId: `${tenant.tenantId}:${sessionId || 'default'}`,
    estimatedCost,
  };

  const result: EvaluationResult = shield.guard(evalRequest, policy);
  tenant.usageCount += 1;

  const response: GuardResponse = {
    allowed: result.allowed,
    reason: result.reason,
    actionTaken: result.actionTaken,
    timestamp: result.timestamp,
    tenantId: tenant.tenantId,
    remediation: result.remediation,
  };

  if (!result.allowed) {
    return reply.code(403).send(response);
  }

  return reply.send(response);
});

// 4. Batch Evaluate Tool Calls (Tenant Isolated)
fastify.post<{ Body: BatchGuardRequest }>('/v1/guard/batch', async (request, reply) => {
  const tenant = request.tenant!;
  const { requests } = request.body;

  if (!requests || !Array.isArray(requests)) {
    return reply.code(400).send({ error: 'requests array required' });
  }

  const results = requests.map(({ toolName, params, agentId, sessionId, policy, estimatedCost }) => {
    const evalRequest: ToolCallRequest = { 
      toolName, 
      params, 
      agentId: agentId || `${tenant.tenantId}-agent`, 
      sessionId: `${tenant.tenantId}:${sessionId || 'default'}`, 
      estimatedCost 
    };
    const result = shield.guard(evalRequest, policy);
    tenant.usageCount += 1;
    return {
      toolName,
      allowed: result.allowed,
      reason: result.reason,
      actionTaken: result.actionTaken,
      timestamp: result.timestamp,
      tenantId: tenant.tenantId,
      remediation: result.remediation,
    };
  });

  return reply.send({ results });
});

// 5. Store Tenant Policy (Keyed by TenantId:PolicyId)
fastify.post<{ Body: PolicyStoreRequest }>('/v1/policies', async (request, reply) => {
  const tenant = request.tenant!;
  const { id, policy } = request.body;

  if (!id || !policy) {
    return reply.code(400).send({ error: 'Missing id or policy' });
  }

  const storeKey = `${tenant.tenantId}:${id}`;
  tenantPolicyStore.set(storeKey, policy);
  return reply.send({ id, stored: true, tenantId: tenant.tenantId });
});

// 6. Retrieve Tenant Policy
fastify.get<{ Params: { id: string } }>('/v1/policies/:id', async (request, reply) => {
  const tenant = request.tenant!;
  const storeKey = `${tenant.tenantId}:${request.params.id}`;
  const policy = tenantPolicyStore.get(storeKey);
  
  if (!policy) {
    return reply.code(404).send({ error: 'Policy not found for tenant' });
  }
  return reply.send(policy);
});

// 7. Delete Tenant Policy
fastify.delete<{ Params: { id: string } }>('/v1/policies/:id', async (request, reply) => {
  const tenant = request.tenant!;
  const storeKey = `${tenant.tenantId}:${request.params.id}`;
  const deleted = tenantPolicyStore.delete(storeKey);
  return reply.send({ deleted, tenantId: tenant.tenantId });
});

// 8. Health Check
fastify.get('/health', async () => {
  return { status: 'ok', version: '0.1.0', mode: 'multi-tenant' };
});

// 9. Policy JSON Schema
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
    console.log(`🛡️ AgentShield Multi-Tenant Gateway running on http://${host}:${port}`);
    console.log(`   POST   /v1/auth/keys      - Provision isolated API key`);
    console.log(`   GET    /v1/auth/usage     - Get tenant usage & quota metrics`);
    console.log(`   POST   /v1/guard          - Evaluate tool call (x-api-key authenticated)`);
    console.log(`   POST   /v1/guard/batch    - Evaluate batch tool calls`);
    console.log(`   POST   /v1/policies       - Store tenant policy`);
    console.log(`   GET    /v1/policies/:id   - Retrieve tenant policy`);
    console.log(`   GET    /v1/schema         - JSON schema for policies`);
    console.log(`   GET    /health            - Health check`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();