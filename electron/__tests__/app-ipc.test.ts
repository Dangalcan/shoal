import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain, shell } from 'electron';

vi.mock('../logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  getLogsDirectory: vi.fn(() => '/home/ana/.config/Shoal/logs'),
}));
vi.mock('electron', () => ({
  app: { getVersion: vi.fn(() => '0.9.0') },
  ipcMain: { handle: vi.fn() },
  shell: { openPath: vi.fn() },
}));

import log from '../logger';
import { registerAppIpcHandlers } from '../ipc/app-ipc';

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

describe('app IPC handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerAppIpcHandlers();
  });

  it('get-app-info reports version, platform and the logs folder', async () => {
    const result = await getHandler('get-app-info')(mockEvent);
    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        version: 'v0.9.0',
        platform: process.platform,
        arch: process.arch,
        logsPath: '/home/ana/.config/Shoal/logs',
      }),
    });
  });

  it('open-logs-folder opens the logs directory', async () => {
    vi.mocked(shell.openPath).mockResolvedValue('');
    const result = await getHandler('open-logs-folder')(mockEvent);
    expect(shell.openPath).toHaveBeenCalledWith('/home/ana/.config/Shoal/logs');
    expect(result).toEqual({ success: true, data: true });
  });

  it('open-logs-folder fails with the message shell.openPath returns', async () => {
    vi.mocked(shell.openPath).mockResolvedValue('No application found');
    const result = await getHandler('open-logs-folder')(mockEvent);
    expect(result).toEqual({ success: false, error: 'No application found' });
  });

  it('log-renderer-error writes a clipped report to the main log', async () => {
    await getHandler('log-renderer-error')(mockEvent, {
      source: 'error-boundary',
      message: 'TypeError: x is undefined',
      stack: 'at Foo\n'.repeat(1000),
    });

    expect(log.error).toHaveBeenCalledTimes(1);
    const written = String(vi.mocked(log.error).mock.calls[0]?.[0]);
    expect(written.startsWith('[Renderer:error-boundary] TypeError')).toBe(
      true
    );
    expect(written.length).toBeLessThan(4200);
  });

  it('log-renderer-error survives malformed reports', async () => {
    const result = await getHandler('log-renderer-error')(mockEvent, null);
    expect(result.success).toBe(true);
    expect(log.error).toHaveBeenCalledWith('[Renderer:renderer] Unknown error');
  });
});
