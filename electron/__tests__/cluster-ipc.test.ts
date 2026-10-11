import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain, shell } from 'electron';

vi.mock('../logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('electron', () => ({
  app: { getVersion: vi.fn(() => '0.9.0'), isPackaged: false },
  ipcMain: { handle: vi.fn() },
  shell: { openExternal: vi.fn() },
}));
vi.mock('../utils/safe-exec', () => ({ safeExec: vi.fn() }));
vi.mock('../services/cluster/cluster-management-service', () => ({
  clusterManagementService: { createCluster: vi.fn(), deleteCluster: vi.fn() },
}));
vi.mock('../services/settings/app-settings', () => ({
  appSettings: { update: vi.fn() },
  assertKubeconfigPath: vi.fn(),
}));

import { registerClusterIpcHandlers } from '../ipc/cluster-ipc';
import {
  appSettings,
  assertKubeconfigPath,
} from '../services/settings/app-settings';
import { safeExec } from '../utils/safe-exec';
import { clusterManagementService } from '../services/cluster/cluster-management-service';

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

describe('cluster IPC handlers', () => {
  const originalKubeconfig = process.env.KUBECONFIG;

  beforeEach(() => {
    vi.clearAllMocks();
    registerClusterIpcHandlers();
  });

  afterEach(() => {
    if (originalKubeconfig === undefined) delete process.env.KUBECONFIG;
    else process.env.KUBECONFIG = originalKubeconfig;
  });

  describe('set-kubeconfig-path', () => {
    it('validates, applies and saves a path', async () => {
      vi.mocked(assertKubeconfigPath).mockResolvedValue(undefined);

      const result = await getHandler('set-kubeconfig-path')(
        mockEvent,
        '  /home/ana/.kube/config  '
      );

      expect(result.success).toBe(true);
      expect(assertKubeconfigPath).toHaveBeenCalledWith(
        '/home/ana/.kube/config'
      );
      expect(process.env.KUBECONFIG).toBe('/home/ana/.kube/config');
      expect(appSettings.update).toHaveBeenCalledWith({
        kubeconfigPath: '/home/ana/.kube/config',
      });
    });

    it('keeps the previous value when the file does not exist', async () => {
      process.env.KUBECONFIG = '/previous';
      vi.mocked(assertKubeconfigPath).mockRejectedValue(
        new Error('Kubeconfig file not found: /nope')
      );

      const result = await getHandler('set-kubeconfig-path')(
        mockEvent,
        '/nope'
      );

      expect(result).toEqual({
        success: false,
        error: 'Kubeconfig file not found: /nope',
      });
      expect(process.env.KUBECONFIG).toBe('/previous');
      expect(appSettings.update).not.toHaveBeenCalled();
    });

    it('clears the setting with an empty value', async () => {
      process.env.KUBECONFIG = '/previous';

      await getHandler('set-kubeconfig-path')(mockEvent, '');

      expect(process.env.KUBECONFIG).toBeUndefined();
      expect(appSettings.update).toHaveBeenCalledWith({
        kubeconfigPath: undefined,
      });
    });
  });

  describe('get-kubeconfig-path', () => {
    it('returns the KUBECONFIG in use, or an empty string', async () => {
      process.env.KUBECONFIG = '/custom/config';
      expect(await getHandler('get-kubeconfig-path')(mockEvent)).toEqual({
        success: true,
        data: '/custom/config',
      });

      delete process.env.KUBECONFIG;
      expect(await getHandler('get-kubeconfig-path')(mockEvent)).toEqual({
        success: true,
        data: '',
      });
    });
  });

  describe('open-external', () => {
    it('opens http(s) links in the browser', async () => {
      const result = await getHandler('open-external')(
        mockEvent,
        'https://shoal.dangalcan.com'
      );

      expect(result).toEqual({ success: true, data: true });
      expect(shell.openExternal).toHaveBeenCalledWith(
        'https://shoal.dangalcan.com/'
      );
    });

    it('refuses other schemes', async () => {
      const result = await getHandler('open-external')(
        mockEvent,
        'file:///etc/passwd'
      );

      expect(result.success).toBe(false);
      expect(shell.openExternal).not.toHaveBeenCalled();
    });
  });

  describe('clusters and contexts', () => {
    it('creates and deletes clusters through the cluster service', async () => {
      vi.mocked(clusterManagementService.createCluster).mockResolvedValue(
        'created' as never
      );
      vi.mocked(clusterManagementService.deleteCluster).mockResolvedValue(
        'deleted' as never
      );

      const created = await getHandler('create-cluster')(mockEvent, {
        name: 'dev',
        provider: 'kind',
      });
      const deleted = await getHandler('delete-cluster')(mockEvent, 'dev');

      expect(clusterManagementService.createCluster).toHaveBeenCalledWith(
        'dev',
        'kind'
      );
      expect(clusterManagementService.deleteCluster).toHaveBeenCalledWith(
        'dev'
      );
      expect(created).toEqual({ success: true, data: 'created' });
      expect(deleted).toEqual({ success: true, data: 'deleted' });
    });

    it('lists kubeconfig contexts without blank lines', async () => {
      vi.mocked(safeExec).mockResolvedValue({
        stdout: 'kind-dev\nk3d-test\n\n',
        stderr: '',
      });

      const result = await getHandler('get-clusters')(mockEvent);

      expect(safeExec).toHaveBeenCalledWith('kubectl', [
        'config',
        'get-contexts',
        '-o',
        'name',
      ]);
      expect(result).toEqual({ success: true, data: ['kind-dev', 'k3d-test'] });
    });

    it('reads the current context', async () => {
      vi.mocked(safeExec).mockResolvedValue({
        stdout: 'kind-dev\n',
        stderr: '',
      });

      expect(await getHandler('get-current-context')(mockEvent)).toEqual({
        success: true,
        data: 'kind-dev',
      });
    });

    it('switches to a valid context and rejects a flag-like name', async () => {
      vi.mocked(safeExec).mockResolvedValue({ stdout: '', stderr: '' });

      const ok = await getHandler('switch-context')(mockEvent, 'kind-dev');
      expect(ok).toEqual({ success: true, data: true });
      expect(safeExec).toHaveBeenCalledWith('kubectl', [
        'config',
        'use-context',
        'kind-dev',
      ]);

      vi.mocked(safeExec).mockClear();
      const bad = await getHandler('switch-context')(
        mockEvent,
        '--kubeconfig=/tmp/x'
      );
      expect(bad.success).toBe(false);
      expect(safeExec).not.toHaveBeenCalled();
    });
  });

  describe('app info', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('reports the marketplace flag', async () => {
      vi.stubEnv('MARKETPLACE_ENABLED', 'true');
      expect(await getHandler('get-feature-flags')(mockEvent)).toEqual({
        success: true,
        data: { marketplace: true },
      });

      vi.stubEnv('MARKETPLACE_ENABLED', '');
      expect(await getHandler('get-feature-flags')(mockEvent)).toEqual({
        success: true,
        data: { marketplace: false },
      });
    });

    it('reports the app version from package.json', async () => {
      expect(await getHandler('get-app-version')(mockEvent)).toEqual({
        success: true,
        data: 'v0.9.0',
      });
    });
  });
});
