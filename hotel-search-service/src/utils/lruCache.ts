/**
 * Minimal LRU cache with per-entry TTL.
 *
 * Autocomplete responses are identical for every user, so the same handful of
 * prefixes ("go", "goa", "del") are recomputed constantly. Caching them keeps
 * the hot path off both the CPU and MongoDB.
 */
export class LruCache<V> {
  private readonly store = new Map<string, { value: V; expiresAt: number }>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;

    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    // Re-insert to mark as most-recently-used (Map preserves insertion order).
    this.store.delete(key);
    this.store.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V): void {
    if (this.store.has(key)) this.store.delete(key);
    else if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
