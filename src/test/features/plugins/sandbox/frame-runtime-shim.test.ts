import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeElectronShim,
  wrapResult,
} from '../../../../features/plugins/sandbox/frame-runtime';
import type { K8sPluginSdk } from '../../../../features/plugins/sandbox/plugin-sdk';

/** A fake SDK whose every leaf method is a spy resolving to a tagged value. */
function fakeSdk(): {
  sdk: K8sPluginSdk;
  calls: Record<string, ReturnType<typeof vi.fn>>;
} {
  const make = (tag: string) => vi.fn().mockResolvedValue(`${tag}-ok`);
  const calls: Record<string, ReturnType<typeof vi.fn>> = {
    getResources: make('getResources'),
    getPods: make('getPods'),
    getNamespaces: make('getNamespaces'),
    getLogs: make('getLogs'),
    describeResource: make('describeResource'),
    getResourceYaml: make('getResourceYaml'),
    deleteResource: make('deleteResource'),
    getCurrentContext: make('getCurrentContext'),
    getClusters: make('getClusters'),
    apply: make('apply'),
    save: make('save'),
    get: make('get'),
    set: make('set'),
    openExternal: make('openExternal'),
  };
  const sdk = {
    kubernetes: {
      getResources: calls.getResources,
      getPods: calls.getPods,
      getNamespaces: calls.getNamespaces,
      getLogs: calls.getLogs,
      describeResource: calls.describeResource,
      getResourceYaml: calls.getResourceYaml,
      deleteResource: calls.deleteResource,
      getCurrentContext: calls.getCurrentContext,
      getClusters: calls.getClusters,
    },
    manifests: { apply: calls.apply, save: calls.save },
    settings: { get: calls.get, set: calls.set },
    ui: { openExternal: calls.openExternal },
  } as unknown as K8sPluginSdk;
  return { sdk, calls };
}

describe('wrapResult', () => {
  it('wraps a resolved value into a success envelope', async () => {
    await expect(wrapResult(Promise.resolve(42))).resolves.toEqual({
      success: true,
      data: 42,
    });
  });

  it('wraps an Error rejection into a failure envelope with its message', async () => {
    await expect(
      wrapResult(Promise.reject(new Error('boom')))
    ).resolves.toEqual({
      success: false,
      error: 'boom',
    });
  });

  it('stringifies a non-Error rejection', async () => {
    await expect(wrapResult(Promise.reject('nope'))).resolves.toEqual({
      success: false,
      error: 'nope',
    });
  });
});

describe('makeElectronShim', () => {
  let shim: Record<string, (...a: unknown[]) => Promise<unknown>>;
  let calls: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    const f = fakeSdk();
    calls = f.calls;
    shim = makeElectronShim(f.sdk) as Record<
      string,
      (...a: unknown[]) => Promise<unknown>
    >;
  });

  it('routes each kubernetes method through the sdk and wraps the result', async () => {
    await expect(shim.getResources({ q: 1 })).resolves.toEqual({
      success: true,
      data: 'getResources-ok',
    });
    expect(calls.getResources).toHaveBeenCalledWith({ q: 1 });

    await expect(shim.getPods('ctx')).resolves.toEqual({
      success: true,
      data: 'getPods-ok',
    });
    await expect(shim.getNamespaces('ctx')).resolves.toEqual({
      success: true,
      data: 'getNamespaces-ok',
    });
    await shim.getLogs({ podName: 'p' });
    await shim.describeResource({ a: 1 });
    await shim.getResourceYaml({ a: 1 });
    await shim.deleteResource({ a: 1 });
    await shim.getCurrentContext();
    await shim.getClusters();
    expect(calls.getClusters).toHaveBeenCalled();
  });

  it('routes manifest methods', async () => {
    await expect(shim.applyManifest(7)).resolves.toEqual({
      success: true,
      data: 'apply-ok',
    });
    expect(calls.apply).toHaveBeenCalledWith(7);
    await shim.saveManifest({ kind: 'Pod' });
    expect(calls.save).toHaveBeenCalledWith({ kind: 'Pod' });
  });

  it('routes settings, ignoring the id the plugin passes for setPluginSettings', async () => {
    await shim.getPluginSettings();
    expect(calls.get).toHaveBeenCalled();
    await shim.setPluginSettings('ignored-id', { theme: 'dark' });
    // The id argument is dropped; only the settings object reaches the sdk.
    expect(calls.set).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('routes ui.openExternal', async () => {
    await expect(shim.openExternal('https://x.test')).resolves.toEqual({
      success: true,
      data: 'openExternal-ok',
    });
    expect(calls.openExternal).toHaveBeenCalledWith('https://x.test');
  });
});
