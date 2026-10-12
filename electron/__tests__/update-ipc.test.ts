import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';

vi.mock('../logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));
vi.mock('../services/update', () => ({
  updateService: {
    checkForUpdates: vi.fn(),
    quitAndInstall: vi.fn(),
    getStatus: vi.fn(),
  },
}));

import { registerUpdateIpcHandlers } from '../ipc/update-ipc';
import { updateService } from '../services/update';

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

describe('update IPC handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerUpdateIpcHandlers();
  });

  it('check-for-updates returns what the service says, without forcing', async () => {
    // Forcing in development builds left the About button spinning:
    // electron-updater resolves to null and emits no event there.
    vi.mocked(updateService.checkForUpdates).mockResolvedValue('dev');

    const result = await getHandler('check-for-updates')(mockEvent);

    expect(updateService.checkForUpdates).toHaveBeenCalledWith();
    expect(result).toEqual({ success: true, data: 'dev' });
  });

  it('install-update asks the service to quit and install', async () => {
    const result = await getHandler('install-update')(mockEvent);

    expect(updateService.quitAndInstall).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, data: true });
  });

  it('get-update-status returns the last status the service saw', async () => {
    vi.mocked(updateService.getStatus).mockReturnValue({
      state: 'downloaded',
      version: '2.0.0',
    });

    const result = await getHandler('get-update-status')(mockEvent);

    expect(result).toEqual({
      success: true,
      data: { state: 'downloaded', version: '2.0.0' },
    });
  });
});
