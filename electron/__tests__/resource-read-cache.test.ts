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

  it('keeps sharing an in-flight read past the TTL instead of starting another', async () => {
    const cache = new ResourceReadCache(5000);
    let resolve!: (v: unknown[]) => void;
    const fetch = vi.fn(() => new Promise<unknown[]>((r) => (resolve = r)));

    const p1 = cache.getOrFetch('ctx|pods|all', fetch);
    vi.advanceTimersByTime(20_000); // kubectl stuck on a credential prompt
    const p2 = cache.getOrFetch('ctx|pods|all', fetch);
    expect(fetch).toHaveBeenCalledTimes(1);

    resolve([1]);
    await expect(p1).resolves.toEqual([1]);
    await expect(p2).resolves.toEqual([1]);

    // The TTL counts from the answer: a read right after it is a cache hit.
    expect(await cache.getOrFetch('ctx|pods|all', fetch)).toEqual([1]);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(6_000);
    fetch.mockImplementation(() => Promise.resolve([2]));
    expect(await cache.getOrFetch('ctx|pods|all', fetch)).toEqual([2]);
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

  it('a read that settles after clear() does not touch the newer entry', async () => {
    const cache = new ResourceReadCache(5000);
    let resolveOld!: (v: unknown[]) => void;
    let resolveNew!: (v: unknown[]) => void;
    const fetch = vi
      .fn<() => Promise<unknown[]>>()
      .mockImplementationOnce(() => new Promise((r) => (resolveOld = r)))
      .mockImplementationOnce(() => new Promise((r) => (resolveNew = r)))
      .mockResolvedValue(['third']);

    const stale = cache.getOrFetch('k', fetch);
    cache.clear(); // a mutation happened while the read was in flight
    const fresh = cache.getOrFetch('k', fetch);

    resolveOld(['stale']);
    await expect(stale).resolves.toEqual(['stale']);
    // The newer read is still in flight and still shared.
    expect(cache.getOrFetch('k', fetch)).toBe(fresh);

    resolveNew(['fresh']);
    await expect(fresh).resolves.toEqual(['fresh']);
    expect(await cache.getOrFetch('k', fetch)).toEqual(['fresh']);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('a read that fails after clear() does not drop the newer entry', async () => {
    const cache = new ResourceReadCache(5000);
    let rejectOld!: (e: Error) => void;
    let resolveNew!: (v: unknown[]) => void;
    const fetch = vi
      .fn<() => Promise<unknown[]>>()
      .mockImplementationOnce(
        () => new Promise((_r, reject) => (rejectOld = reject))
      )
      .mockImplementationOnce(() => new Promise((r) => (resolveNew = r)));

    const stale = cache.getOrFetch('k', fetch);
    cache.clear();
    const fresh = cache.getOrFetch('k', fetch);

    rejectOld(new Error('old read failed'));
    await expect(stale).rejects.toThrow('old read failed');
    expect(cache.size()).toBe(1);
    expect(cache.getOrFetch('k', fetch)).toBe(fresh);

    resolveNew(['fresh']);
    await expect(fresh).resolves.toEqual(['fresh']);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
