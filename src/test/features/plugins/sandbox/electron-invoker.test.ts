import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElectronInvoker } from '../../../../features/plugins/sandbox/electron-invoker';
import type { ElectronAPI } from '../../../../types.d';

/**
 * Build a mock ElectronAPI whose relevant methods each resolve to a
 * `{ success: true, data }` envelope tagged with the method name, so a test can
 * assert both that the right method was routed AND that its `data` was unwrapped.
 */
function mockElectron(overrides?: Partial<ElectronAPI>): {
  electron: ElectronAPI;
  fns: Record<string, ReturnType<typeof vi.fn>>;
} {
  const method = (name: string) =>
    vi.fn().mockResolvedValue({ success: true, data: `${name}-data` });
  const fns: Record<string, ReturnType<typeof vi.fn>> = {
    getResources: method('getResources'),
    getPods: method('getPods'),
    getNamespaces: method('getNamespaces'),
    getLogs: method('getLogs'),
    getPodMetrics: method('getPodMetrics'),
    describeResource: method('describeResource'),
    getResourceYaml: method('getResourceYaml'),
    deleteResource: method('deleteResource'),
    getCurrentContext: method('getCurrentContext'),
    getClusters: method('getClusters'),
    applyManifest: method('applyManifest'),
    saveManifest: method('saveManifest'),
    getPluginSettings: method('getPluginSettings'),
    setPluginSettings: method('setPluginSettings'),
    openExternal: method('openExternal'),
    helmInstall: method('helmInstall'),
    helmUpgrade: method('helmUpgrade'),
    helmRollback: method('helmRollback'),
    helmUninstall: method('helmUninstall'),
    helmRepoAdd: method('helmRepoAdd'),
    helmRepoList: method('helmRepoList'),
  };
  const electron = { ...fns, ...overrides } as unknown as ElectronAPI;
  return { electron, fns };
}

describe('createElectronInvoker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('routes kubernetes.getResources and unwraps data', async () => {
    const { electron, fns } = mockElectron();
    const invoke = createElectronInvoker(electron);
    const arg = { contextName: 'ctx', resourceType: 'pods', namespace: 'ns' };
    await expect(invoke('kubernetes.getResources', [arg])).resolves.toBe(
      'getResources-data'
    );
    expect(fns.getResources).toHaveBeenCalledWith(arg);
  });

  it('routes kubernetes.getPods with the context string', async () => {
    const { electron, fns } = mockElectron();
    const invoke = createElectronInvoker(electron);
    await expect(invoke('kubernetes.getPods', ['ctx'])).resolves.toBe(
      'getPods-data'
    );
    expect(fns.getPods).toHaveBeenCalledWith('ctx');
  });

  it('routes kubernetes.getNamespaces', async () => {
    const { electron, fns } = mockElectron();
    const invoke = createElectronInvoker(electron);
    await expect(invoke('kubernetes.getNamespaces', ['ctx'])).resolves.toBe(
      'getNamespaces-data'
    );
    expect(fns.getNamespaces).toHaveBeenCalledWith('ctx');
  });

  it('routes kubernetes.getLogs', async () => {
    const { electron, fns } = mockElectron();
    const invoke = createElectronInvoker(electron);
    const arg = { contextName: 'c', podName: 'p', namespace: 'n' };
    await expect(invoke('kubernetes.getLogs', [arg])).resolves.toBe(
      'getLogs-data'
    );
    expect(fns.getLogs).toHaveBeenCalledWith(arg);
  });

  it('routes kubernetes.getPodMetrics', async () => {
    const { electron, fns } = mockElectron();
    const invoke = createElectronInvoker(electron);
    const arg = { contextName: 'c', namespace: 'n' };
    await expect(invoke('kubernetes.getPodMetrics', [arg])).resolves.toBe(
      'getPodMetrics-data'
    );
    expect(fns.getPodMetrics).toHaveBeenCalledWith(arg);
  });

  it('routes kubernetes.describeResource', async () => {
    const { electron, fns } = mockElectron();
    const invoke = createElectronInvoker(electron);
    await expect(
      invoke('kubernetes.describeResource', [{ a: 1 }])
    ).resolves.toBe('describeResource-data');
    expect(fns.describeResource).toHaveBeenCalledWith({ a: 1 });
  });

  it('routes kubernetes.getResourceYaml', async () => {
    const { electron, fns } = mockElectron();
    const invoke = createElectronInvoker(electron);
    await expect(
      invoke('kubernetes.getResourceYaml', [{ a: 1 }])
    ).resolves.toBe('getResourceYaml-data');
    expect(fns.getResourceYaml).toHaveBeenCalledWith({ a: 1 });
  });

  it('routes kubernetes.deleteResource', async () => {
    const { electron, fns } = mockElectron();
    const invoke = createElectronInvoker(electron);
    await expect(invoke('kubernetes.deleteResource', [{ a: 1 }])).resolves.toBe(
      'deleteResource-data'
    );
    expect(fns.deleteResource).toHaveBeenCalledWith({ a: 1 });
  });

  it('routes kubernetes.getCurrentContext with no args', async () => {
    const { electron, fns } = mockElectron();
    const invoke = createElectronInvoker(electron);
    await expect(invoke('kubernetes.getCurrentContext', [])).resolves.toBe(
      'getCurrentContext-data'
    );
    expect(fns.getCurrentContext).toHaveBeenCalledTimes(1);
  });

  it('routes kubernetes.getClusters with no args', async () => {
    const { electron, fns } = mockElectron();
    const invoke = createElectronInvoker(electron);
    await expect(invoke('kubernetes.getClusters', [])).resolves.toBe(
      'getClusters-data'
    );
    expect(fns.getClusters).toHaveBeenCalledTimes(1);
  });

  it('routes manifests.apply with the numeric id', async () => {
    const { electron, fns } = mockElectron();
    const invoke = createElectronInvoker(electron);
    await expect(invoke('manifests.apply', [42])).resolves.toBe(
      'applyManifest-data'
    );
    expect(fns.applyManifest).toHaveBeenCalledWith(42);
  });

  it('routes manifests.save', async () => {
    const { electron, fns } = mockElectron();
    const invoke = createElectronInvoker(electron);
    await expect(invoke('manifests.save', [{ kind: 'Pod' }])).resolves.toBe(
      'saveManifest-data'
    );
    expect(fns.saveManifest).toHaveBeenCalledWith({ kind: 'Pod' });
  });

  it.each([
    ['helm.install', 'helmInstall'],
    ['helm.upgrade', 'helmUpgrade'],
    ['helm.rollback', 'helmRollback'],
    ['helm.uninstall', 'helmUninstall'],
    ['helm.repoAdd', 'helmRepoAdd'],
  ])('routes %s with its args object', async (method, fnName) => {
    const { electron, fns } = mockElectron();
    const invoke = createElectronInvoker(electron);
    const arg = { releaseName: 'r' };
    await expect(invoke(method, [arg])).resolves.toBe(`${fnName}-data`);
    expect(fns[fnName]).toHaveBeenCalledWith(arg);
  });

  it('routes helm.repoList with no args', async () => {
    const { electron, fns } = mockElectron();
    const invoke = createElectronInvoker(electron);
    await expect(invoke('helm.repoList', [])).resolves.toBe(
      'helmRepoList-data'
    );
    expect(fns.helmRepoList).toHaveBeenCalledTimes(1);
  });

  it('routes settings.get with the injected plugin id', async () => {
    const { electron, fns } = mockElectron();
    const invoke = createElectronInvoker(electron);
    await expect(invoke('settings.get', ['my-plugin'])).resolves.toBe(
      'getPluginSettings-data'
    );
    expect(fns.getPluginSettings).toHaveBeenCalledWith('my-plugin');
  });

  it('routes settings.set with plugin id and settings object', async () => {
    const { electron, fns } = mockElectron();
    const invoke = createElectronInvoker(electron);
    await expect(
      invoke('settings.set', ['my-plugin', { theme: 'dark' }])
    ).resolves.toBe('setPluginSettings-data');
    expect(fns.setPluginSettings).toHaveBeenCalledWith('my-plugin', {
      theme: 'dark',
    });
  });

  it('routes ui.openExternal', async () => {
    const { electron, fns } = mockElectron();
    const invoke = createElectronInvoker(electron);
    await expect(
      invoke('ui.openExternal', ['https://example.com'])
    ).resolves.toBe('openExternal-data');
    expect(fns.openExternal).toHaveBeenCalledWith('https://example.com');
  });

  it('throws the error from a failed Result envelope', async () => {
    const { electron } = mockElectron({
      getClusters: vi
        .fn()
        .mockResolvedValue({ success: false, error: 'boom' }) as never,
    });
    const invoke = createElectronInvoker(electron);
    await expect(invoke('kubernetes.getClusters', [])).rejects.toThrow('boom');
  });

  it('throws a default message when a failed Result has no error text', async () => {
    const { electron } = mockElectron({
      getClusters: vi.fn().mockResolvedValue({ success: false }) as never,
    });
    const invoke = createElectronInvoker(electron);
    await expect(invoke('kubernetes.getClusters', [])).rejects.toThrow(
      'Plugin API call failed'
    );
  });

  it('passes through a non-Result value unchanged', async () => {
    const { electron } = mockElectron({
      getClusters: vi.fn().mockResolvedValue('plain-value') as never,
    });
    const invoke = createElectronInvoker(electron);
    await expect(invoke('kubernetes.getClusters', [])).resolves.toBe(
      'plain-value'
    );
  });

  it('throws for an unrouted method', async () => {
    const { electron } = mockElectron();
    const invoke = createElectronInvoker(electron);
    await expect(invoke('process.exit', [])).rejects.toThrow(
      'Unrouted plugin method: "process.exit"'
    );
  });
});
