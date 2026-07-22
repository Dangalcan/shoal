/**
 * Resource Read Cache
 *
 * Short-TTL, in-flight-deduplicating cache for kubectl list reads. Several
 * plugins (and their dashboard widgets) independently poll the same resource
 * lists — secrets alone are fetched by four separate timers — so identical
 * reads inside a small window collapse into one kubectl invocation.
 *
 * Correctness rules:
 *  - concurrent identical reads share one promise (in-flight dedup)
 *  - a resolved entry is served for at most `ttlMs`
 *  - rejected fetches are never cached
 *  - every cluster mutation calls `clear()` so the next read is fresh
 */

interface CacheEntry {
  at: number;
  promise: Promise<unknown[]>;
}

const DEFAULT_TTL_MS = 5_000;

export class ResourceReadCache {
  private entries = new Map<string, CacheEntry>();

  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS) {}

  /**
   * Return the cached list for `key` when fresh, otherwise run `fetch` and
   * share its promise with any caller arriving before it settles.
   */
  getOrFetch(key: string, fetch: () => Promise<unknown[]>): Promise<unknown[]> {
    const now = Date.now();
    const hit = this.entries.get(key);
    if (hit && now - hit.at < this.ttlMs) {
      return hit.promise;
    }

    const promise = fetch();
    this.entries.set(key, { at: now, promise });
    // Never serve a failed read from cache
    promise.catch(() => {
      if (this.entries.get(key)?.promise === promise) {
        this.entries.delete(key);
      }
    });
    return promise;
  }

  /** Drop everything — called after any cluster mutation. */
  clear(): void {
    this.entries.clear();
  }

  /** Current number of cached keys (for tests/diagnostics). */
  size(): number {
    return this.entries.size;
  }
}

export const resourceReadCache = new ResourceReadCache();
