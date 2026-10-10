import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';

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
});
