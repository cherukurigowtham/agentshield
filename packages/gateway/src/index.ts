import Fastify, { FastifyInstance, FastifyRequest, FastifyReply, FastifyListenOptions, FastifyServerOptions } from 'fastify';
import { AgentShield, GuardrailPolicy, ToolCallRequest, EvaluationResult } from '@agentshield/sdk';
import crypto from 'node:crypto';
import { getRedisStore, RedisStore } from './store/redisStore.js';
import authPlugin, { 
  verifyAPIKey, 
  createAPIKey, 
  revokeAPIKey, 
  listAPIKeys, 
  getAPIKey,
  APIKey,
  hashAPIKey,
  generateAPIKey,
  ROLE_PERMISSIONS
} from './auth/index.js';
import { loadTLSConfig, createTLSOptions, TLSOptions } from './tls/index.js';
import https from 'node:https';
import fs from 'node:fs';

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

interface CreateAPIKeyRequest {
  name: string;
  roles?: string[];
  expiresInDays?: number;
}

interface RevokeAPIKeyRequest {
  keyId: string;
}

interface AuthContext {
  tenantId: string;
  keyId: string;
  roles: string[];
  permissions: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    tenant?: TenantAccount;
    auth?: AuthContext;
  }
  interface FastifyInstance {
    verifyAPIKey: typeof verifyAPIKey;
    createAPIKey: typeof createAPIKey;
    revokeAPIKey: typeof revokeAPIKey;
    listAPIKeys: typeof listAPIKeys;
    getAPIKey: typeof getAPIKey;
  }
}
 
// Build Fastify options with optional HTTPS
function buildFastifyOptions() {
  const baseOptions = {
    logger: {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
  };
  
  try {
    const tlsConfig = loadTLSConfig();
    if (tlsConfig.enabled) {
      const opts = createTLSOptions(tlsConfig);
      return { ...baseOptions, https: opts };
    }
  } catch {
    // Ignore TLS config errors during startup
  }
  return baseOptions;
}

const fastify = Fastify(buildFastifyOptions()) as FastifyInstance & {
  verifyAPIKey: typeof verifyAPIKey;
  createAPIKey: typeof createAPIKey;
  revokeAPIKey: typeof revokeAPIKey;
  listAPIKeys: typeof listAPIKeys;
  getAPIKey: typeof getAPIKey;
};

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

interface CreateAPIKeyRequest {
  name: string;
  roles?: string[];
  expiresInDays?: number;
}

interface RevokeAPIKeyRequest {
  keyId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    tenant?: TenantAccount;
    auth?: {
      tenantId: string;
      keyId: string;
      roles: string[];
      permissions: string[];
    };
  }
}

// Initialize Redis store
const shield = new AgentShield();

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

// Seed default demo tenant
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

// Authentication hook
fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
  // Public routes - no auth required
  const publicRoutes = ['/health', '/v1/schema', '/v1/auth/login'];
  if (publicRoutes.some(r => request.url.startsWith(r))) {
    return;
  }

  // Get API key from header
  const authHeader = request.headers['authorization'] || request.headers['x-api-key'];
  if (!authHeader) {
    return reply.code(401).send({ error: 'Missing Authorization or x-api-key header' });
  }

  const rawKey = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const apiKey = rawKey.startsWith('Bearer ') ? rawKey.substring(7) : rawKey;

  // Use the auth plugin's verifyAPIKey
  const verified = fastify.verifyAPIKey(apiKey);
  if (!verified) {
    // Fallback to demo tenant for backward compatibility
    if (process.env.NODE_ENV !== 'production') {
      request.tenant = demoTenant;
      return;
    }
    return reply.code(401).send({ error: 'Invalid or revoked API key' });
  }

  // Check if demo tenant
  if (verified.tenantId === 'tenant_demo_001') {
    request.tenant = demoTenant;
    (request as any).auth = {
      tenantId: verified.tenantId,
      keyId: verified.id,
      roles: verified.roles,
      permissions: verified.permissions,
    };
    return;
  }

  // Get tenant from store
  const tenant = tenantKeys.get(verified.prefix) || 
                 Array.from(tenantKeys.values()).find(t => t.tenantId === verified.tenantId);
  
  if (!tenant) {
    return reply.code(401).send({ error: 'Tenant not found for API key' });
  }

  // Quota check
  if (tenant.usageCount >= tenant.monthlyQuota && tenant.plan !== 'enterprise') {
    return reply.code(429).send({
      error: `Monthly API quota limit reached (${tenant.usageCount}/${tenant.monthlyQuota}). Upgrade to Pro or Enterprise plan.`,
      tenantId: tenant.tenantId,
      plan: tenant.plan,
    });
  }

  request.tenant = tenant;
  (request as any).auth = {
    tenantId: verified.tenantId,
    keyId: verified.id,
    roles: verified.roles,
    permissions: verified.permissions,
  };
});

// Permission check helper
function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = (request as any).auth;
    if (!auth || !auth.permissions.includes(permission)) {
      return reply.code(403).send({ 
        error: 'Forbidden', 
        required: permission,
        has: auth?.permissions || [] 
      });
    }
  };
}

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

// 1. Provision New Tenant (creates tenant + initial admin API key)
fastify.post<{ Body: { name: string; plan?: 'free' | 'pro' | 'enterprise' } }>('/v1/auth/tenants', async (request, reply) => {
  const { name, plan = 'free' } = request.body || {};

  if (!name) {
    return reply.code(400).send({ error: 'Missing account name parameter' });
  }

  const tenantId = `tenant_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  
  const quotas: Record<string, number> = {
    free: 10000,
    pro: 1000000,
    enterprise: 100000000,
  };

  const newTenant: TenantAccount = {
    tenantId,
    key: '', // Will be set after API key creation
    name,
    plan,
    monthlyQuota: quotas[plan] || 10000,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  };

  // Create initial admin API key for the tenant
  const { apiKey, plainKey } = fastify.createAPIKey(tenantId, 'Initial Admin Key', ['admin']);
  newTenant.key = plainKey; // Store the plain key for the tenant lookup
  
  tenantKeys.set(plainKey, newTenant);

  return reply.send({
    message: 'Tenant provisioned successfully',
    tenantId,
    apiKey: plainKey,
    plan,
    monthlyQuota: newTenant.monthlyQuota,
    keyId: apiKey.id,
  });
});

// 2. Login - returns JWT token for session-based auth
fastify.post<{ Body: { apiKey: string } }>('/v1/auth/login', async (request, reply) => {
  const { apiKey } = request.body || {};
  
  if (!apiKey) {
    return reply.code(400).send({ error: 'Missing apiKey' });
  }

  const verified = fastify.verifyAPIKey(apiKey);
  if (!verified) {
    return reply.code(401).send({ error: 'Invalid API key' });
  }

  // Generate JWT token
  const token = fastify.jwt.sign({
    sub: verified.tenantId,
    tid: verified.tenantId,
    keyId: verified.id,
    roles: verified.roles,
    permissions: verified.permissions,
  }, { expiresIn: '24h' });

  return reply.send({
    access_token: token,
    token_type: 'Bearer',
    expires_in: 86400,
    tenantId: verified.tenantId,
  });
});

// 3. Create additional API key for tenant (requires keys:write permission)
fastify.post<{ Body: CreateAPIKeyRequest }>('/v1/auth/keys', {
  preHandler: [requirePermission('keys:write')],
}, async (request, reply) => {
  const auth = (request as any).auth;
  const { name, roles = ['developer'], expiresInDays } = request.body || {};

  if (!name) {
    return reply.code(400).send({ error: 'Missing key name' });
  }

  const { apiKey, plainKey } = fastify.createAPIKey(
    auth.tenantId,
    name,
    roles,
    expiresInDays
  );

  return reply.send({
    message: 'API key created successfully',
    keyId: apiKey.id,
    apiKey: plainKey, // Only returned once!
    name: apiKey.name,
    roles: apiKey.roles,
    permissions: apiKey.permissions,
    expiresAt: apiKey.expiresAt,
    createdAt: apiKey.createdAt,
  });
});

// 4. List API keys for tenant (requires keys:read permission)
fastify.get('/v1/auth/keys', {
  preHandler: [requirePermission('keys:read')],
}, async (request, reply) => {
  const auth = (request as any).auth;
  const keys = fastify.listAPIKeys(auth.tenantId);
  
  return reply.send({
    keys: keys.map(k => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      roles: k.roles,
      permissions: k.permissions,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      revoked: k.revoked,
    })),
  });
});

// 5. Revoke API key (requires keys:revoke permission)
fastify.post<{ Body: RevokeAPIKeyRequest }>('/v1/auth/keys/revoke', {
  preHandler: [requirePermission('keys:revoke')],
}, async (request, reply) => {
  const auth = (request as any).auth;
  const { keyId } = request.body || {};

  if (!keyId) {
    return reply.code(400).send({ error: 'Missing keyId' });
  }

  const key = fastify.getAPIKey(keyId);
  if (!key || key.tenantId !== auth.tenantId) {
    return reply.code(404).send({ error: 'API key not found' });
  }

  const revoked = fastify.revokeAPIKey(keyId);
  
  return reply.send({
    message: revoked ? 'API key revoked successfully' : 'API key already revoked',
    keyId,
  });
});

// 6. Get current tenant info
fastify.get('/v1/auth/me', async (request, reply) => {
  const auth = (request as any).auth;
  const tenant = request.tenant;
  
  return reply.send({
    tenantId: auth.tenantId,
    keyId: auth.keyId,
    roles: auth.roles,
    permissions: auth.permissions,
    tenant: tenant ? {
      tenantId: tenant.tenantId,
      name: tenant.name,
      plan: tenant.plan,
      monthlyQuota: tenant.monthlyQuota,
      usageCount: tenant.usageCount,
      remainingQuota: Math.max(0, tenant.monthlyQuota - tenant.usageCount),
    } : null,
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
fastify.post<{ Body: PolicyStoreRequest }>('/v1/policies', {
  preHandler: [requirePermission('policy:write')],
}, async (request, reply) => {
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
  
  return reply.code(503).send({ error: 'Policy storage unavailable - Redis not connected' });
});

// Retrieve Tenant Policy (Redis)
fastify.get<{ Params: { id: string } }>('/v1/policies/:id', {
  preHandler: [requirePermission('policy:read')],
}, async (request, reply) => {
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
fastify.delete<{ Params: { id: string } }>('/v1/policies/:id', {
  preHandler: [requirePermission('policy:delete')],
}, async (request, reply) => {
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
fastify.get('/v1/policies', {
  preHandler: [requirePermission('policy:read')],
}, async (request, reply) => {
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

const start = async () => {
  try {
    // Register auth plugin
    await fastify.register(authPlugin);
    
    // Initialize Redis
    await initRedis();
    
    // Check if TLS was enabled during Fastify creation
    const isTLS = !!fastify.server && 'addContext' in fastify.server;
    
    const port = parseInt(process.env.PORT || '8080', 10);
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    const protocol = isTLS ? 'https' : 'http';
    if (isTLS) {
      console.log('🔒 TLS/mTLS enabled');
    }
    console.log(`🛡️ AgentShield Multi-Tenant Gateway running on ${protocol}://${host}:${port}`);
    console.log(`   POST   /v1/auth/tenants     - Provision new tenant + admin API key`);
    console.log(`   POST   /v1/auth/login       - Login with API key, returns JWT`);
    console.log(`   POST   /v1/auth/keys        - Create API key (keys:write)`);
    console.log(`   GET    /v1/auth/keys        - List API keys (keys:read)`);
    console.log(`   POST   /v1/auth/keys/revoke - Revoke API key (keys:revoke)`);
    console.log(`   GET    /v1/auth/me          - Current tenant info`);
    console.log(`   POST   /v1/guard            - Evaluate tool call`);
    console.log(`   POST   /v1/guard/batch      - Batch evaluate tool calls`);
    console.log(`   POST   /v1/policies         - Store policy (policy:write)`);
    console.log(`   GET    /v1/policies/:id     - Get policy (policy:read)`);
    console.log(`   DELETE /v1/policies/:id     - Delete policy (policy:delete)`);
    console.log(`   GET    /v1/policies         - List policies (policy:read)`);
    console.log(`   GET    /v1/schema           - JSON schema for policies`);
    console.log(`   GET    /health              - Health check (with Redis status)`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1)
  }
};

start();