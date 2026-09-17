import { FastifyPluginAsync } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

export interface JWTPayload {
  sub: string;           // tenantId
  tid: string;           // tenantId (alias)
  keyId: string;         // API key ID
  roles: string[];       // ['admin', 'developer', 'viewer']
  permissions: string[]; // ['guard:read', 'guard:write', 'policy:read', 'policy:write', 'billing:read']
  iat: number;
  exp: number;
}

export interface APIKey {
  id: string;
  tenantId: string;
  name: string;
  keyHash: string;       // HMAC-SHA256 of the key
  prefix: string;        // First 8 chars for identification
  roles: string[];
  permissions: string[];
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  revoked: boolean;
}

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'guard:read', 'guard:write',
    'policy:read', 'policy:write', 'policy:delete',
    'tenant:read', 'tenant:write', 'tenant:delete',
    'billing:read', 'billing:write',
    'audit:read', 'audit:export',
    'keys:read', 'keys:write', 'keys:revoke',
  ],
  developer: [
    'guard:read', 'guard:write',
    'policy:read', 'policy:write',
    'tenant:read',
    'audit:read',
    'keys:read', 'keys:write',
  ],
  viewer: [
    'guard:read',
    'policy:read',
    'tenant:read',
    'audit:read',
  ],
};

const keyStore = new Map<string, APIKey>(); // keyId -> APIKey
const hashToKeyId = new Map<string, string>(); // keyHash -> keyId

export function hashAPIKey(key: string): string {
  return createHmac('sha256', process.env.API_KEY_HMAC_SECRET || 'dev-secret-change-in-production')
    .update(key)
    .digest('hex');
}

export function generateAPIKey(): { key: string; prefix: string; keyHash: string; keyId: string } {
  const keyId = `key_${randomBytes(8).toString('hex')}`;
  const randomPart = randomBytes(24).toString('base64url');
  const key = `ag_${keyId}_${randomPart}`;
  const prefix = key.substring(0, 20); // ag_key_xxxxxxxx_...
  const keyHash = hashAPIKey(key);
  return { key, prefix, keyHash, keyId };
}

export function createAPIKey(
  tenantId: string,
  name: string,
  roles: string[] = ['developer'],
  expiresInDays?: number
): { apiKey: APIKey; plainKey: string } {
  const { key, prefix, keyHash, keyId } = generateAPIKey();
  
  const permissions = new Set<string>();
  for (const role of roles) {
    for (const perm of ROLE_PERMISSIONS[role] || []) {
      permissions.add(perm);
    }
  }

  const apiKey: APIKey = {
    id: keyId,
    tenantId,
    name,
    keyHash,
    prefix,
    roles,
    permissions: Array.from(permissions),
    createdAt: new Date().toISOString(),
    expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000).toISOString() : undefined,
    revoked: false,
  };

  keyStore.set(keyId, apiKey);
  hashToKeyId.set(keyHash, keyId);

  return { apiKey, plainKey: key };
}

export function verifyAPIKey(providedKey: string): APIKey | null {
  const keyHash = hashAPIKey(providedKey);
  const keyId = hashToKeyId.get(keyHash);
  if (!keyId) return null;
  
  const apiKey = keyStore.get(keyId);
  if (!apiKey || apiKey.revoked) return null;
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) return null;
  
  apiKey.lastUsedAt = new Date().toISOString();
  return apiKey;
}

export function revokeAPIKey(keyId: string): boolean {
  const apiKey = keyStore.get(keyId);
  if (!apiKey) return false;
  apiKey.revoked = true;
  hashToKeyId.delete(apiKey.keyHash);
  return true;
}

export function listAPIKeys(tenantId: string): APIKey[] {
  return Array.from(keyStore.values()).filter(k => k.tenantId === tenantId);
}

export function getAPIKey(keyId: string): APIKey | undefined {
  return keyStore.get(keyId);
}

export const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Register JWT
  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    sign: { algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  });

  // Decorate fastify with auth helpers
  fastify.decorate('verifyAPIKey', verifyAPIKey);
  fastify.decorate('createAPIKey', createAPIKey);
  fastify.decorate('revokeAPIKey', revokeAPIKey);
  fastify.decorate('listAPIKeys', listAPIKeys);
  fastify.decorate('getAPIKey', getAPIKey);

  // Auth hook
  fastify.addHook('onRequest', async (request, reply) => {
    // Public routes
    const publicRoutes = ['/health', '/v1/schema', '/v1/auth/login', '/v1/auth/keys'];
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

    const verified = verifyAPIKey(apiKey);
    if (!verified) {
      return reply.code(401).send({ error: 'Invalid or revoked API key' });
    }

    // Attach tenant context
    (request as any).auth = {
      tenantId: verified.tenantId,
      keyId: verified.id,
      roles: verified.roles,
      permissions: verified.permissions,
    };
  });

  // Permission check decorator
  fastify.decorate('requirePermission', (permission: string) => {
    return async (request: any, reply: any) => {
      const auth = request.auth;
      if (!auth || !auth.permissions.includes(permission)) {
        return reply.code(403).send({ 
          error: 'Forbidden', 
          required: permission,
          has: auth?.permissions || [] 
        });
      }
    };
  });
};

export default authPlugin;