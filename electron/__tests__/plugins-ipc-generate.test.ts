import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';
import fs from 'fs';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
}));
vi.mock('../logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../services/plugins/plugin-manager', () => ({ pluginManager: {} }));
vi.mock('../services/plugins/plugin-events', () => ({ pluginEventBus: {} }));
vi.mock('../services/security/license-manager', () => ({ licenseManager: {} }));
vi.mock('../services/plugins/template-service', () => ({
  templateService: { scaffoldPlugin: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../services/plugins/path-service', () => ({
  pathService: {
    getUserPluginsDir: vi.fn(() => '/user/plugins'),
    isBundledPluginId: vi.fn().mockResolvedValue(false),
  },
}));

import { registerPluginsIpcHandlers } from '../ipc/plugins-ipc';
import { pathService } from '../services/plugins/path-service';
import { templateService } from '../services/plugins/template-service';

type IpcHandler = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<{ success: boolean; error?: string }>;

function generate(id: string) {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === 'generate-plugin');
  if (!call) throw new Error('generate-plugin is not registered');
  return (call[1] as IpcHandler)({} as IpcMainInvokeEvent, {
    id,
    name: 'Mine',
    author: 'Me',
    description: 'Mine',
  });
}

describe('generate-plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    registerPluginsIpcHandlers();
  });

  it('scaffolds a new plugin in the user plugins directory', async () => {
    const result = await generate('my-plugin');
    expect(result.success).toBe(true);
    expect(templateService.scaffoldPlugin).toHaveBeenCalled();
  });

  it('refuses the id of a bundled plugin', async () => {
    vi.mocked(pathService.isBundledPluginId).mockResolvedValueOnce(true);

    const result = await generate('resource-monitor');

    expect(result).toEqual({
      success: false,
      error: 'A plugin with id "resource-monitor" already exists',
    });
    expect(templateService.scaffoldPlugin).not.toHaveBeenCalled();
  });
});
