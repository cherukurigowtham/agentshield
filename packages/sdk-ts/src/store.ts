import { AuditRecord } from './audit.js';

export class PersistentStore {
  private filePath: string;
  private inMemoryStore: AuditRecord[] = [];

  constructor(customPath?: string) {
    this.filePath = customPath || '.agentshield_data/audit_store.json';
    this.initStorage(customPath);
  }

  private initStorage(customPath?: string) {
    if (typeof window !== 'undefined') return;
    try {
      // Universal Node check
      const fs = typeof require !== 'undefined' ? require('fs') : null;
      const path = typeof require !== 'undefined' ? require('path') : null;
      if (fs && path) {
        const dir = customPath ? path.dirname(customPath) : path.join(process.cwd(), '.agentshield_data');
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        this.filePath = customPath || path.join(dir, 'audit_store.json');
      }
    } catch {
      // Fallback to in-memory store
    }
  }

  saveAuditRecord(record: AuditRecord): void {
    if (typeof window !== 'undefined') {
      this.inMemoryStore.push(record);
      if (this.inMemoryStore.length > 1000) this.inMemoryStore.shift();
      return;
    }
    try {
      const fs = typeof require !== 'undefined' ? require('fs') : null;
      if (fs) {
        const records = this.loadRecords();
        records.push(record);
        if (records.length > 10000) records.shift();
        fs.writeFileSync(this.filePath, JSON.stringify(records, null, 2), 'utf-8');
      } else {
        this.inMemoryStore.push(record);
      }
    } catch {
      this.inMemoryStore.push(record);
    }
  }

  loadRecords(): AuditRecord[] {
    if (typeof window !== 'undefined') return this.inMemoryStore;
    try {
      const fs = typeof require !== 'undefined' ? require('fs') : null;
      if (fs && fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch {
      // Fallback
    }
    return this.inMemoryStore;
  }
}
