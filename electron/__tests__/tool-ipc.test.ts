import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';

vi.mock('../logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));
vi.mock('../services/tools/tool-service', () => ({
  toolService: { getToolStatus: vi.fn() },
}));

import { registerToolIpcHandlers } from '../ipc/tool-ipc';
import { toolService } from '../services/tools/tool-service';

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

describe('tool IPC handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerToolIpcHandlers();
  });

  it('get-tool-status returns the probe result', async () => {
    const status = { tool: 'kubectl', installed: true, version: 'v1.31' };
    vi.mocked(toolService.getToolStatus).mockResolvedValue(status);

    const result = await getHandler('get-tool-status')(mockEvent, 'kubectl');

    expect(result).toEqual({ success: true, data: status });
  });

  it('registers only get-tool-status (check-tool is gone)', () => {
    const channels = vi.mocked(ipcMain.handle).mock.calls.map(([c]) => c);
    expect(channels).toEqual(['get-tool-status']);
  });
});
