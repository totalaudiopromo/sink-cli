interface MxEntry {
  hasMx: boolean;
  blanketReject?: boolean;
  ts: number;
}

/**
 * MX lookup cache to avoid redundant DNS lookups in batch processing.
 */
export class MxCache {
  private cache = new Map<string, MxEntry>();
  private ttlMs: number;

  constructor(ttlSeconds = 1800) {
    this.ttlMs = ttlSeconds * 1000;
  }

  get(domain: string): { hasMx: boolean; blanketReject?: boolean } | null {
    const entry = this.cache.get(domain);
    if (entry && Date.now() - entry.ts < this.ttlMs) {
      return { hasMx: entry.hasMx, blanketReject: entry.blanketReject };
    }
    return null;
  }

  set(domain: string, hasMx: boolean, blanketReject?: boolean): void {
    this.cache.set(domain, { hasMx, blanketReject, ts: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
