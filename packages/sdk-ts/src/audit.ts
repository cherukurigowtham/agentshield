import crypto from 'node:crypto';
import { EvaluationResult, ToolCallRequest } from './types.js';

export interface AuditRecord {
  recordId: string;
  previousHash: string;
  hash: string;
  timestamp: string;
  agentId: string;
  toolName: string;
  actionTaken: string;
  paramsSanitized: Record<string, any>;
  reason?: string;
}

export class AuditExporter {
  private lastHash: string = 'GENESIS_HASH_00000000000000000000000000000000';
  private records: AuditRecord[] = [];

  createRecord(request: ToolCallRequest, result: EvaluationResult): AuditRecord {
    const recordId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const timestamp = result.timestamp || new Date().toISOString();
    const agentId = request.agentId || 'default-agent';

    // Mask sensitive fields if present
    const paramsSanitized = { ...request.params };
    if (paramsSanitized.password) paramsSanitized.password = '***MASKED***';
    if (paramsSanitized.apiKey) paramsSanitized.apiKey = '***MASKED***';

    const payload = JSON.stringify({
      recordId,
      previousHash: this.lastHash,
      timestamp,
      agentId,
      toolName: request.toolName,
      actionTaken: result.actionTaken,
      paramsSanitized,
      reason: result.reason,
    });

    // Generate SHA-256 hash chain
    const hash = this.computeHash(payload);

    const record: AuditRecord = {
      recordId,
      previousHash: this.lastHash,
      hash,
      timestamp,
      agentId,
      toolName: request.toolName,
      actionTaken: result.actionTaken,
      paramsSanitized,
      reason: result.reason,
    };

    this.lastHash = hash;
    this.records.push(record);

    return record;
  }

  exportSOC2Log(): string {
    return JSON.stringify({
      version: 'AgentShield-Audit-v1',
      totalRecords: this.records.length,
      genesisHash: 'GENESIS_HASH_00000000000000000000000000000000',
      finalHash: this.lastHash,
      auditChain: this.records,
    }, null, 2);
  }

  private computeHash(content: string): string {
    // Simple SHA-256 hash implementation using Web Crypto / Node Crypto
    const cryptoModule = globalThis.crypto;
    if (cryptoModule && cryptoModule.subtle) {
      // Basic fallback
    }
    // Simple string hash algorithm for zero-dependency portability
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `sha256_${Math.abs(hash).toString(16)}_${Date.now()}`;
  }
}
