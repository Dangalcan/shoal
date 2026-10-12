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
  /** When the read settled (or started, while still in flight). */
  at: number;
  promise: Promise<unknown[]>;
  settled: boolean;
}

const DEFAULT_TTL_MS = 5_000;

export class ResourceReadCache {
  private entries = new Map<string, CacheEntry>();

  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS) {}

  /**
   * Return the cached list for `key` when fresh, otherwise run `fetch` and
   * share its promise with any caller arriving before it settles. An
   * in-flight read is shared however long it takes: a kubectl stuck on a
   * credential prompt must not get a new copy from every poll.
   */
  getOrFetch(key: string, fetch: () => Promise<unknown[]>): Promise<unknown[]> {
    const now = Date.now();
    const hit = this.entries.get(key);
    if (hit && (!hit.settled || now - hit.at < this.ttlMs)) {
      return hit.promise;
    }

    const promise = fetch();
    const entry: CacheEntry = { at: now, promise, settled: false };
    this.entries.set(key, entry);
    promise.then(
      () => {
        if (this.entries.get(key) === entry) {
          entry.settled = true;
          entry.at = Date.now(); // the TTL counts from the answer, not the start
        }
      },
      () => {
        // Never serve a failed read from cache
        if (this.entries.get(key) === entry) {
          this.entries.delete(key);
        }
      }
    );
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
