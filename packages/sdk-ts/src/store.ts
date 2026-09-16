import fs from 'node:fs';
import path from 'node:path';
import { AuditRecord } from './audit.js';

export class PersistentStore {
  private filePath: string;

  constructor(customPath?: string) {
    const dir = customPath ? path.dirname(customPath) : path.join(process.cwd(), '.agentshield_data');
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // Fallback
      }
    }
    this.filePath = customPath || path.join(dir, 'audit_store.json');
  }

  saveAuditRecord(record: AuditRecord): void {
    try {
      const records = this.loadRecords();
      records.push(record);
      // Keep last 10,000 records on disk
      if (records.length > 10000) {
        records.shift();
      }
      fs.writeFileSync(this.filePath, JSON.stringify(records, null, 2), 'utf-8');
    } catch {
      // Non-blocking disk write
    }
  }

  loadRecords(): AuditRecord[] {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch {
      // Fallback
    }
    return [];
  }
}
