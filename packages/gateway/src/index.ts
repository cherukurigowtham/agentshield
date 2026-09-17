import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { AgentShield, GuardrailPolicy, ToolCallRequest, EvaluationResult } from '@agentshield/sdk';
import crypto from 'node:crypto';
import { getRedisStore, RedisStore } from './store/redisStore.js';

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

// Initialize Redis store
let redisStore: RedisStore | null = null;
let redisEnabled = false;

async function initRedis(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    fastify.log.warn('REDIS_URL not set - running in-memory mode (data not persisted)');
    return;
  }
  
  try {
    redisStore = getRedisStore({
      url: redisUrl,
      keyPrefix: 'agentshield:gateway:',
      defaultTtlSeconds: parseInt(process.env.REDIS_TTL_SECONDS || '86400', 10),
    });
    await redisStore.connect();
    redisEnabled = true;
    fastify.log.info('Redis store connected');
  } catch (err) {
    fastify.log.warn({ err }, 'Failed to connect to Redis - running in-memory mode');
    redisStore = null;
    redisEnabled = false;
  }
}

// In-memory fallback for tenant keys (small, frequently accessed)
const tenantKeys = new Map<string, TenantAccount>();

// Seed default demo key
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
  if (request.url === '/health' || request.url === '/v1/schema' || request.url === '/v1/auth/keys') {
    return;
  }

  const apiKeyHeader = request.headers['x-api-key'] || request.headers['authorization'];
  let rawKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
  if (rawKey && rawKey.startsWith('Bearer ')) {
    rawKey = rawKey.substring(7);
  }

  if (!rawKey) {
    request.tenant = demoTenant;
    return;
  }

  const tenant = tenantKeys.get(rawKey);
  if (!tenant) {
    return reply.code(401).send({
      error: 'Unauthorized: Invalid API key provided in x-api-key header.',
    });
  }

  if (tenant.usageCount >= tenant.monthlyQuota && tenant.plan !== 'enterprise') {
    return reply.code(429).send({
      error: `Monthly API quota limit reached (${tenant.usageCount}/${tenant.monthlyQuota}). Upgrade to Pro or Enterprise plan.`,
      tenantId: tenant.tenantId,
      plan: tenant.plan,
    });
  }

  request.tenant = tenant;
});

// Provision New Isolated API Key
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

// Retrieve Tenant API Usage Metrics
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

// Evaluate Single Tool Call (Tenant Isolated + Redis Persistence)
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

  // Persist telemetry to Redis (non-blocking)
  if (redisEnabled && redisStore) {
    try {
      await redisStore.appendTelemetry({
        tenantId: tenant.tenantId,
        toolName,
        agentId: evalRequest.agentId,
        sessionId: evalRequest.sessionId,
        params,
        actionTaken: result.actionTaken,
        reason: result.reason,
        timestamp: result.timestamp,
        allowed: result.allowed,
      });
    } catch (err) {
      fastify.log.warn({ err }, 'Failed to persist telemetry');
    }
  }

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

// Batch Evaluate Tool Calls
fastify.post<{ Body: BatchGuardRequest }>('/v1/guard/batch', async (request, reply) => {
  const tenant = request.tenant!;
  const { requests } = request.body;

  if (!requests || !Array.isArray(requests)) {
    return reply.code(400).send({ error: 'requests array required' });
  }

  const results = await Promise.all(requests.map(async ({ toolName, params, agentId, sessionId, policy, estimatedCost }) => {
    const evalRequest: ToolCallRequest = { 
      toolName, 
      params, 
      agentId: agentId || `${tenant.tenantId}-agent`, 
      sessionId: `${tenant.tenantId}:${sessionId || 'default'}`, 
      estimatedCost 
    };
    const result = shield.guard(evalRequest, policy);
    tenant.usageCount += 1;

    // Persist telemetry
    if (redisEnabled && redisStore) {
      try {
        await redisStore.appendTelemetry({
          tenantId: tenant.tenantId,
          toolName,
          agentId: evalRequest.agentId,
          sessionId: evalRequest.sessionId,
          params,
          actionTaken: result.actionTaken,
          reason: result.reason,
          timestamp: result.timestamp,
          allowed: result.allowed,
        });
      } catch (err) {
        fastify.log.warn({ err }, 'Failed to persist batch telemetry');
      }
    }

    return {
      toolName,
      allowed: result.allowed,
      reason: result.reason,
      actionTaken: result.actionTaken,
      timestamp: result.timestamp,
      tenantId: tenant.tenantId,
      remediation: result.remediation,
    };
  }));

  return reply.send({ results });
});

// Store Tenant Policy (Redis)
fastify.post<{ Body: PolicyStoreRequest }>('/v1/policies', async (request, reply) => {
  const tenant = request.tenant!;
  const { id, policy } = request.body;

  if (!id || !policy) {
    return reply.code(400).send({ error: 'Missing id or policy' });
  }

  if (redisEnabled && redisStore) {
    try {
      await redisStore.storePolicy(`${tenant.tenantId}:${id}`, policy);
      return reply.send({ id, stored: true, tenantId: tenant.tenantId });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to store policy');
      return reply.code(500).send({ error: 'Failed to store policy' });
    }
  }
  
  // Fallback to in-memory
  return reply.code(503).send({ error: 'Policy storage unavailable - Redis not connected' });
});

// Retrieve Tenant Policy (Redis)
fastify.get<{ Params: { id: string } }>('/v1/policies/:id', async (request, reply) => {
  const tenant = request.tenant!;
  
  if (redisEnabled && redisStore) {
    try {
      const policy = await redisStore.getPolicy(`${tenant.tenantId}:${request.params.id}`);
      if (!policy) {
        return reply.code(404).send({ error: 'Policy not found for tenant' });
      }
      return reply.send(policy);
    } catch (err) {
      fastify.log.error({ err }, 'Failed to retrieve policy');
      return reply.code(500).send({ error: 'Failed to retrieve policy' });
    }
  }
  
  return reply.code(503).send({ error: 'Policy storage unavailable - Redis not connected' });
});

// Delete Tenant Policy (Redis)
fastify.delete<{ Params: { id: string } }>('/v1/policies/:id', async (request, reply) => {
  const tenant = request.tenant!;
  
  if (redisEnabled && redisStore) {
    try {
      const deleted = await redisStore.deletePolicy(`${tenant.tenantId}:${request.params.id}`);
      return reply.send({ deleted, tenantId: tenant.tenantId });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to delete policy');
      return reply.code(500).send({ error: 'Failed to delete policy' });
    }
  }
  
  return reply.code(503).send({ error: 'Policy storage unavailable - Redis not connected' });
});

// List Tenant Policies (Redis)
fastify.get('/v1/policies', async (request, reply) => {
  const tenant = request.tenant!;
  
  if (redisEnabled && redisStore) {
    try {
      const allPolicies = await redisStore.listPolicies();
      const tenantPolicies = allPolicies
        .filter(p => p.startsWith(`${tenant.tenantId}:`))
        .map(p => p.replace(`${tenant.tenantId}:`, ''));
      return reply.send({ policies: tenantPolicies });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to list policies');
      return reply.code(500).send({ error: 'Failed to list policies' });
    }
  }
  
  return reply.code(503).send({ error: 'Policy storage unavailable - Redis not connected' });
});

// Health Check with Redis connectivity
fastify.get('/health', async () => {
  const redisHealthy = redisEnabled && redisStore ? await redisStore.ping() : false;
  return { 
    status: redisHealthy ? 'ok' : 'degraded', 
    version: '0.1.0', 
    mode: 'multi-tenant',
    redis: redisHealthy ? 'connected' : (redisEnabled ? 'disconnected' : 'disabled'),
  };
});

// Policy JSON Schema
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
    // Initialize Redis
    await initRedis();
    
    const port = parseInt(process.env.PORT || '8080', 10);
    const host = process.env.HOST || '0.0.0.0';
    await fastify.listen({ port, host });
    console.log(`🛡️ AgentShield Multi-Tenant Gateway running on http://${host}:${port}`);
    console.log(`   POST   /v1/auth/keys      - Provision isolated API key`);
    console.log(`   GET    /v1/auth/usage     - Get tenant usage & quota metrics`);
    console.log(`   POST   /v1/guard          - Evaluate tool call (x-api-key authenticated)`);
    console.log(`   POST   /v1/guard/batch    - Evaluate batch tool calls`);
    console.log(`   POST   /v1/policies       - Store tenant policy (Redis)`);
    console.log(`   GET    /v1/policies/:id   - Retrieve tenant policy (Redis)`);
    console.log(`   GET    /v1/policies       - List tenant policies (Redis)`);
    console.log(`   GET    /v1/schema         - JSON schema for policies`);
    console.log(`   GET    /health            - Health check (with Redis status)`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1)
  }
};

start();