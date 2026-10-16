import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  LocalPluginModule,
  withinTimeout,
} from '../services/plugins/host/module-handle';
import type { PluginContext } from '../types/plugin-types';

/**
 * The in-process module handle: which exports it exposes, how it calls
 * them, and the call budget that keeps a hanging hook from blocking the
 * caller.
 */
describe('LocalPluginModule', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes only the functions the module itself exports', () => {
    const exports = Object.assign(Object.create({ inherited() {} }), {
      activate() {},
      version: '1.0.0',
    });
    const handle = new LocalPluginModule(exports);

    expect(handle.has('activate')).toBe(true);
    expect(handle.has('version')).toBe(false);
    expect(handle.has('inherited')).toBe(false);
    expect(handle.has('toString')).toBe(false);
    expect(handle.isRemote).toBe(false);
  });

  it('passes the context to lifecycle hooks and positional arguments to actions', async () => {
    const activate = vi.fn(async (ctx: PluginContext) => ctx.pluginId);
    const add = vi.fn((a: number, b: number) => a + b);
    const handle = new LocalPluginModule({ activate, add });
    const context = { pluginId: 'p1' } as PluginContext;

    expect(
      await handle.invoke('activate', { withContext: true }, context)
    ).toBe('p1');
    expect(await handle.invoke('add', { args: [2, 3] })).toBe(5);
    expect(await handle.invoke('add')).toBeNaN();
  });

  it('rejects an export that is not a function', async () => {
    const handle = new LocalPluginModule({ value: 1 });

    await expect(handle.invoke('value')).rejects.toThrow(
      'Export "value" is not a function'
    );
    await expect(handle.invoke('missing')).rejects.toThrow(
      'Export "missing" is not a function'
    );
  });

  it('turns a synchronous throw into a rejection', async () => {
    const handle = new LocalPluginModule({
      boom: () => {
        throw new Error('sync failure');
      },
    });

    await expect(handle.invoke('boom', { timeoutMs: 1_000 })).rejects.toThrow(
      'sync failure'
    );
  });
});

describe('LocalPluginModule call budget', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives up on a call that outlives its budget while the call keeps running', async () => {
    vi.useFakeTimers();
    let finished = false;
    const slow = () =>
      new Promise<void>((resolve) =>
        setTimeout(() => {
          finished = true;
          resolve();
        }, 5_000)
      );
    const handle = new LocalPluginModule({ slow });

    const outcome = handle
      .invoke('slow', { timeoutMs: 1_000 })
      .catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(1_001);

    expect(await outcome).toEqual(new Error('slow() timed out after 1000 ms'));
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(finished).toBe(true);
  });

  it('returns the result of a call that finishes within its budget', async () => {
    vi.useFakeTimers();
    const quick = () =>
      new Promise<string>((resolve) => setTimeout(() => resolve('ok'), 100));
    const handle = new LocalPluginModule({ quick });

    const call = handle.invoke('quick', { timeoutMs: 1_000 });
    await vi.advanceTimersByTimeAsync(101);

    expect(await call).toBe('ok');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('waits without limit when no budget is given', async () => {
    vi.useFakeTimers();
    const slow = () =>
      new Promise<string>((resolve) =>
        setTimeout(() => resolve('late'), 60_000)
      );
    const handle = new LocalPluginModule({ slow });

    const call = handle.invoke('slow');
    await vi.advanceTimersByTimeAsync(60_001);

    expect(await call).toBe('late');
  });
});

describe('withinTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the promise own rejection when it fails in time', async () => {
    vi.useFakeTimers();
    const failing = Promise.reject(new Error('own failure'));

    await expect(withinTimeout(failing, 1_000, 'work')).rejects.toThrow(
      'own failure'
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});
