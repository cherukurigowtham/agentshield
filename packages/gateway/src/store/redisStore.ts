import { createClient, RedisClientType } from 'redis';
import { GuardrailPolicy, ToolCallRequest, EvaluationResult } from '@agentshield/sdk';

export interface RedisStoreConfig {
  url: string;
  keyPrefix?: string;
  defaultTtlSeconds?: number;
}

export class RedisStore {
  private client: RedisClientType;
  private keyPrefix: string;
  private defaultTtl: number;
  private connected = false;

  constructor(config: RedisStoreConfig) {
    this.client = createClient({ url: config.url });
    this.keyPrefix = config.keyPrefix || 'agentshield:';
    this.defaultTtl = config.defaultTtlSeconds || 86400; // 24 hours
    
    this.client.on('error', (err) => {
      console.error('[RedisStore] Connection error:', err);
      this.connected = false;
    });
    
    this.client.on('connect', () => {
      this.connected = true;
    });
    
    this.client.on('ready', () => {
      this.connected = true;
    });
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Policy management
  async storePolicy(id: string, policy: GuardrailPolicy): Promise<void> {
    await this.connect();
    const key = `${this.keyPrefix}policy:${id}`;
    await this.client.set(key, JSON.stringify(policy));
    await this.client.expire(key, this.defaultTtl);
  }

  async getPolicy(id: string): Promise<GuardrailPolicy | null> {
    await this.connect();
    const key = `${this.keyPrefix}policy:${id}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async listPolicies(): Promise<string[]> {
    await this.connect();
    const pattern = `${this.keyPrefix}policy:*`;
    const keys = await this.client.keys(pattern);
    return keys.map(k => k.replace(`${this.keyPrefix}policy:`, ''));
  }

  async deletePolicy(id: string): Promise<boolean> {
    await this.connect();
    const key = `${this.keyPrefix}policy:${id}`;
    const result = await this.client.del(key);
    return result > 0;
  }

  // Circuit breaker state
  async getCircuitBreakerState(sessionKey: string): Promise<{ tripped: boolean; resetTime?: number } | null> {
    await this.connect();
    const key = `${this.keyPrefix}circuit:${sessionKey}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async setCircuitBreakerState(sessionKey: string, state: { tripped: boolean; resetTime: number }, ttlSeconds: number): Promise<void> {
    await this.connect();
    const key = `${this.keyPrefix}circuit:${sessionKey}`;
    await this.client.set(key, JSON.stringify(state), { EX: ttlSeconds });
  }

  async deleteCircuitBreakerState(sessionKey: string): Promise<void> {
    await this.connect();
    const key = `${this.keyPrefix}circuit:${sessionKey}`;
    await this.client.del(key);
  }

  // Rate limiting
  async getRateLimitCalls(sessionKey: string, windowStart: number): Promise<number[]> {
    await this.connect();
    const key = `${this.keyPrefix}ratelimit:${sessionKey}`;
    const calls = await this.client.zRangeByScore(key, windowStart, '+inf');
    return calls.map(c => parseFloat(c));
  }

  async addRateLimitCall(sessionKey: string, timestamp: number, windowSeconds: number): Promise<number> {
    await this.connect();
    const key = `${this.keyPrefix}ratelimit:${sessionKey}`;
    const count = await this.client.zAdd(key, { score: timestamp, value: timestamp.toString() });
    await this.client.expire(key, windowSeconds + 60);
    return count;
  }

  // Session costs
  async getSessionCost(sessionKey: string): Promise<number> {
    await this.connect();
    const key = `${this.keyPrefix}cost:${sessionKey}`;
    const data = await this.client.get(key);
    return data ? parseFloat(data) : 0;
  }

  async setSessionCost(sessionKey: string, cost: number, ttlSeconds: number = 86400): Promise<void> {
    await this.connect();
    const key = `${this.keyPrefix}cost:${sessionKey}`;
    await this.client.set(key, cost.toString(), { EX: ttlSeconds });
  }

  // Audit log
  async appendAuditLog(record: any): Promise<void> {
    await this.connect();
    const key = `${this.keyPrefix}audit`;
    await this.client.lPush(key, JSON.stringify(record));
    await this.client.lTrim(key, 0, 9999); // Keep last 10k records
    await this.client.expire(key, this.defaultTtl);
  }

  async getAuditLogs(limit: number = 100): Promise<any[]> {
    await this.connect();
    const key = `${this.keyPrefix}audit`;
    const logs = await this.client.lRange(key, 0, limit - 1);
    return logs.map(l => JSON.parse(l));
  }

  // Telemetry
  async appendTelemetry(event: any): Promise<void> {
    await this.connect();
    const key = `${this.keyPrefix}telemetry`;
    await this.client.lPush(key, JSON.stringify(event));
    await this.client.lTrim(key, 0, 4999); // Keep last 5k events
    await this.client.expire(key, this.defaultTtl);
  }

  async getTelemetry(limit: number = 100): Promise<any[]> {
    await this.connect();
    const key = `${this.keyPrefix}telemetry`;
    const events = await this.client.lRange(key, 0, limit - 1);
    return events.map(e => JSON.parse(e));
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      await this.connect();
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let storeInstance: RedisStore | null = null;

export function getRedisStore(config?: RedisStoreConfig): RedisStore {
  if (!storeInstance && config) {
    storeInstance = new RedisStore(config);
  }
  if (!storeInstance) {
    throw new Error('RedisStore not initialized. Call getRedisStore(config) first.');
  }
  return storeInstance;
}

export function initRedisStore(config: RedisStoreConfig): RedisStore {
  storeInstance = new RedisStore(config);
  return storeInstance;
}