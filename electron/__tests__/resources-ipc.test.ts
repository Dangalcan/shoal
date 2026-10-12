import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';

vi.mock('../logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));
vi.mock('../utils/safe-exec', () => ({
  safeExec: vi.fn(),
  ALLOWED_TOOLS: new Set(['kubectl']),
}));
vi.mock('../services/kubernetes/kubernetes-service', () => ({
  READ_TIMEOUT_MS: 30_000,
  kubernetesService: {
    getResources: vi.fn(),
    getPodMetrics: vi.fn(),
    scaleResource: vi.fn(),
    deleteResource: vi.fn(),
  },
}));
vi.mock('../services/kubernetes/resource-read-cache', () => ({
  resourceReadCache: { clear: vi.fn() },
}));

import { safeExec } from '../utils/safe-exec';
import { kubernetesService } from '../services/kubernetes/kubernetes-service';
import { resourceReadCache } from '../services/kubernetes/resource-read-cache';
import { registerResourcesIpcHandlers } from '../ipc/resources-ipc';

type IpcHandler = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

const mockEvent = {} as IpcMainInvokeEvent;

function getHandler(channel: string): IpcHandler {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as IpcHandler;
}

const READ_TIMEOUT = { timeout: 30_000 };

describe('resource IPC handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(safeExec).mockResolvedValue({ stdout: '', stderr: '' });
    registerResourcesIpcHandlers();
  });

  it('get-pods and get-resources go through the cached service', async () => {
    vi.mocked(kubernetesService.getResources).mockResolvedValue([
      { kind: 'Pod' },
    ] as never);

    expect(await getHandler('get-pods')(mockEvent, 'kind-dev')).toEqual({
      success: true,
      data: [{ kind: 'Pod' }],
    });
    expect(kubernetesService.getResources).toHaveBeenCalledWith(
      'pods',
      'all',
      'kind-dev'
    );

    await getHandler('get-resources')(mockEvent, {
      contextName: 'kind-dev',
      resourceType: 'deployments',
      namespace: 'default',
    });
    expect(kubernetesService.getResources).toHaveBeenLastCalledWith(
      'deployments',
      'default',
      'kind-dev'
    );
  });

  it('get-namespaces lists names with the read timeout', async () => {
    vi.mocked(safeExec).mockResolvedValue({
      stdout: 'namespace/default\nnamespace/kube-system\n',
      stderr: '',
    });

    const result = await getHandler('get-namespaces')(mockEvent, 'kind-dev');

    expect(result).toEqual({
      success: true,
      data: ['default', 'kube-system'],
    });
    expect(safeExec).toHaveBeenCalledWith(
      'kubectl',
      ['get', 'namespaces', '--context', 'kind-dev', '-o', 'name'],
      READ_TIMEOUT
    );
  });

  it('get-logs builds the kubectl arguments and times out like other reads', async () => {
    vi.mocked(safeExec).mockResolvedValue({ stdout: 'line 1\n', stderr: '' });

    const result = await getHandler('get-logs')(mockEvent, {
      contextName: 'kind-dev',
      podName: 'web-1',
      namespace: 'default',
      tailLines: 50,
      container: 'sidecar',
      timestamps: true,
      sinceSeconds: 120,
    });

    expect(result).toEqual({ success: true, data: 'line 1\n' });
    expect(safeExec).toHaveBeenCalledWith(
      'kubectl',
      [
        'logs',
        'web-1',
        '--context',
        'kind-dev',
        '-n',
        'default',
        '--tail=50',
        '-c',
        'sidecar',
        '--timestamps',
        '--since=120s',
      ],
      READ_TIMEOUT
    );

    // Defaults: 200 lines, no namespace flag for "all", no container.
    await getHandler('get-logs')(mockEvent, {
      contextName: 'kind-dev',
      podName: 'web-1',
      namespace: 'all',
      tailLines: -1,
    });
    expect(safeExec).toHaveBeenLastCalledWith(
      'kubectl',
      ['logs', 'web-1', '--context', 'kind-dev', '--tail=200'],
      READ_TIMEOUT
    );
  });

  it('describe-resource and get-resource-yaml pass the read timeout', async () => {
    vi.mocked(safeExec).mockResolvedValue({ stdout: 'Name: web', stderr: '' });

    const describe = await getHandler('describe-resource')(mockEvent, {
      contextName: 'kind-dev',
      resourceType: 'pods',
      resourceName: 'web-1',
      namespace: 'default',
    });
    expect(describe).toEqual({ success: true, data: 'Name: web' });
    expect(safeExec).toHaveBeenLastCalledWith(
      'kubectl',
      ['describe', 'pods', 'web-1', '--context', 'kind-dev', '-n', 'default'],
      READ_TIMEOUT
    );

    await getHandler('get-resource-yaml')(mockEvent, {
      contextName: 'kind-dev',
      resourceType: 'pods',
      resourceName: 'web-1',
    });
    expect(safeExec).toHaveBeenLastCalledWith(
      'kubectl',
      ['get', 'pods', 'web-1', '--context', 'kind-dev', '-o', 'yaml'],
      READ_TIMEOUT
    );
  });

  it('rejects arguments that are not valid kubectl identifiers', async () => {
    const result = await getHandler('get-logs')(mockEvent, {
      contextName: 'kind-dev',
      podName: '--all-containers',
      namespace: 'default',
    });
    expect(result.success).toBe(false);
    expect(safeExec).not.toHaveBeenCalled();

    const namespaces = await getHandler('get-namespaces')(
      mockEvent,
      'bad context'
    );
    expect(namespaces.success).toBe(false);
  });

  it('get-pod-metrics validates the namespace and uses the service', async () => {
    vi.mocked(kubernetesService.getPodMetrics).mockResolvedValue([] as never);
    const result = await getHandler('get-pod-metrics')(mockEvent, {
      contextName: 'kind-dev',
      namespace: 'all',
    });
    expect(result).toEqual({ success: true, data: [] });
    expect(kubernetesService.getPodMetrics).toHaveBeenCalledWith(
      'all',
      'kind-dev'
    );
  });

  it('rollout-restart runs kubectl and drops the read cache', async () => {
    const result = await getHandler('rollout-restart')(mockEvent, {
      contextName: 'kind-dev',
      resourceType: 'deployments',
      resourceName: 'web',
      namespace: 'default',
    });
    expect(result).toEqual({ success: true, data: undefined });
    expect(safeExec).toHaveBeenCalledWith('kubectl', [
      'rollout',
      'restart',
      'deployments/web',
      '--context',
      'kind-dev',
      '-n',
      'default',
    ]);
    expect(resourceReadCache.clear).toHaveBeenCalled();
  });

  it('scale-resource validates the replica count', async () => {
    vi.mocked(kubernetesService.scaleResource).mockResolvedValue(
      undefined as never
    );
    const bad = await getHandler('scale-resource')(mockEvent, {
      contextName: 'kind-dev',
      resourceType: 'deployments',
      resourceName: 'web',
      namespace: 'default',
      replicas: -1,
    });
    expect(bad.success).toBe(false);
    expect(kubernetesService.scaleResource).not.toHaveBeenCalled();

    const ok = await getHandler('scale-resource')(mockEvent, {
      contextName: 'kind-dev',
      resourceType: 'deployments',
      resourceName: 'web',
      namespace: 'default',
      replicas: 3,
    });
    expect(ok.success).toBe(true);
    expect(kubernetesService.scaleResource).toHaveBeenCalledWith(
      'deployments',
      'web',
      'default',
      3,
      'kind-dev'
    );
  });

  it('delete-resource goes through the service', async () => {
    vi.mocked(kubernetesService.deleteResource).mockResolvedValue(
      undefined as never
    );
    const result = await getHandler('delete-resource')(mockEvent, {
      contextName: 'kind-dev',
      resourceType: 'pods',
      resourceName: 'web-1',
      namespace: 'all',
    });
    expect(result.success).toBe(true);
    expect(kubernetesService.deleteResource).toHaveBeenCalledWith(
      'pods',
      'web-1',
      'all',
      'kind-dev'
    );
  });
});
