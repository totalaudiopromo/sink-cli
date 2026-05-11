import type { CacheAdapter, SteepResult } from '../../../types.js'

/**
 * In-memory cache adapter. Lifetime = process lifetime.
 *
 * Default for the CLI when no other adapter is configured. Keeps repeat
 * outlets (e.g. 50 contacts at BBC Radio 1) from triggering 50 scrapes.
 */
export class InMemoryCache implements CacheAdapter {
  private store = new Map<string, SteepResult>()

  async get(outletDomain: string): Promise<SteepResult | null> {
    return this.store.get(outletDomain) ?? null
  }

  async set(outletDomain: string, result: SteepResult): Promise<void> {
    this.store.set(outletDomain, result)
  }

  async list(): Promise<string[]> {
    return [...this.store.keys()]
  }

  async invalidate(outletDomain: string): Promise<void> {
    this.store.delete(outletDomain)
  }
}
