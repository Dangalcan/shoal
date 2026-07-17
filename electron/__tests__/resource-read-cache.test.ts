import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResourceReadCache } from '../services/kubernetes/resource-read-cache';

describe('ResourceReadCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shares one in-flight promise between concurrent identical reads', async () => {
    const cache = new ResourceReadCache(5000);
    let resolve!: (v: unknown[]) => void;
    const fetch = vi.fn(() => new Promise<unknown[]>((r) => (resolve = r)));

    const p1 = cache.getOrFetch('ctx|pods|all', fetch);
    const p2 = cache.getOrFetch('ctx|pods|all', fetch);
    expect(fetch).toHaveBeenCalledTimes(1);

    resolve([{ name: 'pod-1' }]);
    await expect(p1).resolves.toEqual([{ name: 'pod-1' }]);
    await expect(p2).resolves.toEqual([{ name: 'pod-1' }]);
  });

  it('serves a resolved entry within the TTL without refetching', async () => {
    const cache = new ResourceReadCache(5000);
    const fetch = vi.fn().mockResolvedValue([1]);

    await cache.getOrFetch('k', fetch);
    vi.advanceTimersByTime(4000);
    await cache.getOrFetch('k', fetch);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('refetches once the TTL has elapsed', async () => {
    const cache = new ResourceReadCache(5000);
    const fetch = vi.fn().mockResolvedValue([1]);

    await cache.getOrFetch('k', fetch);
    vi.advanceTimersByTime(5001);
    await cache.getOrFetch('k', fetch);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keys are independent', async () => {
    const cache = new ResourceReadCache(5000);
    const fetch = vi.fn().mockResolvedValue([]);

    await cache.getOrFetch('a', fetch);
    await cache.getOrFetch('b', fetch);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(cache.size()).toBe(2);
  });

  it('does not cache rejected fetches', async () => {
    const cache = new ResourceReadCache(5000);
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([2]);

    await expect(cache.getOrFetch('k', fetch)).rejects.toThrow('boom');
    await expect(cache.getOrFetch('k', fetch)).resolves.toEqual([2]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('clear() forces the next read to refetch', async () => {
    const cache = new ResourceReadCache(5000);
    const fetch = vi.fn().mockResolvedValue([]);

    await cache.getOrFetch('k', fetch);
    cache.clear();
    await cache.getOrFetch('k', fetch);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
