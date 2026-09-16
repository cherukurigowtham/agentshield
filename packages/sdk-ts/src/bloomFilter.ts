export class BloomFilterGuard {
  private size: number;
  private bitArray: Uint8Array;
  private hashCount: number;

  constructor(size: number = 1024, hashCount: number = 3) {
    this.size = size;
    this.bitArray = new Uint8Array(Math.ceil(size / 8));
    this.hashCount = hashCount;
  }

  add(pattern: string): void {
    const hashes = this.getHashes(pattern);
    for (const h of hashes) {
      const bitIndex = h % this.size;
      const byteIndex = Math.floor(bitIndex / 8);
      const bitOffset = bitIndex % 8;
      this.bitArray[byteIndex] |= (1 << bitOffset);
    }
  }

  mightContain(pattern: string): boolean {
    const hashes = this.getHashes(pattern);
    for (const h of hashes) {
      const bitIndex = h % this.size;
      const byteIndex = Math.floor(bitIndex / 8);
      const bitOffset = bitIndex % 8;
      if ((this.bitArray[byteIndex] & (1 << bitOffset)) === 0) {
        return false; // Definite NO (O(1) Fast Path)
      }
    }
    return true; // Probable YES (Triggers Deep Scan)
  }

  private getHashes(str: string): number[] {
    let hash1 = 5381;
    let hash2 = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash1 = ((hash1 << 5) + hash1) + char;
      hash2 = (hash2 << 5) - hash2 + char;
    }
    const results = [];
    for (let i = 0; i < this.hashCount; i++) {
      results.push(Math.abs(hash1 + i * hash2));
    }
    return results;
  }
}
