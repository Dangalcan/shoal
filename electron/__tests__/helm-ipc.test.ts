import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';
import { registerHelmIpcHandlers } from '../ipc/helm-ipc';
import { helmService } from '../services/helm/helm-service';

/**
 * The Helm IPC handlers are thin: each one forwards its argument to the
 * matching HelmService method (which does the validation) and wraps the
 * outcome in the Result shape.
 */

vi.mock('../logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('../services/helm/helm-service', () => ({
  helmService: {
    install: vi.fn(),
    upgrade: vi.fn(),
    rollback: vi.fn(),
    uninstall: vi.fn(),
    repoAdd: vi.fn(),
    repoList: vi.fn(),
  },
}));

type IpcHandler = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

function getHandler(channel: string): IpcHandler {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as IpcHandler;
}

const mainFrameEvent = {
  senderFrame: { parent: null },
} as unknown as IpcMainInvokeEvent;

const subFrameEvent = {
  senderFrame: { parent: {} },
} as unknown as IpcMainInvokeEvent;

const channels: Array<{
  channel: string;
  method: keyof typeof helmService;
  args: unknown;
  output: unknown;
}> = [
  {
    channel: 'helm:install',
    method: 'install',
    args: {
      contextName: 'kind-a',
      namespace: 'web',
      releaseName: 'r',
      chart: 'bitnami/nginx',
    },
    output: 'release r installed',
  },
  {
    channel: 'helm:upgrade',
    method: 'upgrade',
    args: {
      contextName: 'kind-a',
      namespace: 'web',
      releaseName: 'r',
      chart: 'bitnami/nginx',
    },
    output: 'release r upgraded',
  },
  {
    channel: 'helm:rollback',
    method: 'rollback',
    args: {
      contextName: 'kind-a',
      namespace: 'web',
      releaseName: 'r',
      revision: 2,
    },
    output: 'rolled back',
  },
  {
    channel: 'helm:uninstall',
    method: 'uninstall',
    args: { contextName: 'kind-a', namespace: 'web', releaseName: 'r' },
    output: 'release r uninstalled',
  },
  {
    channel: 'helm:repo-add',
    method: 'repoAdd',
    args: { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' },
    output: '"bitnami" has been added',
  },
  {
    channel: 'helm:repo-list',
    method: 'repoList',
    args: undefined,
    output: [{ name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' }],
  },
];

describe('helm-ipc', () => {
  beforeEach(() => {
    vi.mocked(ipcMain.handle).mockClear();
    for (const { method } of channels) {
      vi.mocked(helmService[method]).mockReset();
    }
    registerHelmIpcHandlers();
  });

  it('registers the six Helm channels', () => {
    const registered = vi.mocked(ipcMain.handle).mock.calls.map(([n]) => n);
    expect(registered).toEqual(channels.map((c) => c.channel));
  });

  for (const { channel, method, args, output } of channels) {
    it(`${channel} forwards to helmService.${method} and wraps the result`, async () => {
      vi.mocked(helmService[method]).mockResolvedValue(output as never);

      const result = await getHandler(channel)(mainFrameEvent, args);

      if (args === undefined) {
        expect(helmService[method]).toHaveBeenCalledWith();
      } else {
        expect(helmService[method]).toHaveBeenCalledWith(args);
      }
      expect(result).toEqual({ success: true, data: output });
    });

    it(`${channel} reports a service error as a failed Result`, async () => {
      vi.mocked(helmService[method]).mockRejectedValue(
        new Error(`Invalid release name: "bad name"`)
      );

      const result = await getHandler(channel)(mainFrameEvent, args);

      expect(result).toEqual({
        success: false,
        error: 'Invalid release name: "bad name"',
      });
    });
  }

  it('refuses calls that do not come from the main frame', async () => {
    const result = await getHandler('helm:repo-list')(subFrameEvent);

    expect(result).toEqual({
      success: false,
      error: 'IPC is only available to the main frame',
    });
    expect(helmService.repoList).not.toHaveBeenCalled();
  });
});
