/**
 * The plugin IPC handlers are thin pass-throughs to the plugin manager and
 * the license manager; generate-plugin has its own file
 * (plugins-ipc-generate.test.ts) for the happy path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain, dialog } from 'electron';
import fs from 'fs';

const mocks = vi.hoisted(() => ({
  pluginManager: {
    getPlugins: vi.fn(),
    enablePlugin: vi.fn(),
    disablePlugin: vi.fn(),
    checkForUpdates: vi.fn(),
    getPluginExtensions: vi.fn(),
    reloadPlugin: vi.fn(),
    executePluginAction: vi.fn(),
    getPluginSettings: vi.fn(),
    updatePluginSettings: vi.fn(),
    uninstallPlugin: vi.fn(),
    importPlugin: vi.fn(),
  },
  licenseManager: {
    activateLicense: vi.fn(),
    startTrial: vi.fn(),
    deactivateLicense: vi.fn(),
  },
  getMainWindow: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
}));
vi.mock('../logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../services/plugins/plugin-manager', () => ({
  pluginManager: mocks.pluginManager,
}));
vi.mock('../services/plugins/plugin-events', () => ({
  pluginEventBus: { getMainWindow: mocks.getMainWindow },
}));
vi.mock('../services/security/license-manager', () => ({
  licenseManager: mocks.licenseManager,
}));
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
import { templateService } from '../services/plugins/template-service';

type IpcHandler = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

const mockEvent = {} as IpcMainInvokeEvent;

function getHandler(channel: string): IpcHandler {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === channel);
  if (!call) throw new Error(`${channel} is not registered`);
  return call[1] as IpcHandler;
}

describe('plugins IPC handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerPluginsIpcHandlers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('pass-through handlers', () => {
    const { pluginManager: pm, licenseManager: lm } = mocks;

    it.each([
      ['get-plugins', pm.getPlugins, [], [{ id: 'a' }], [{ id: 'a' }]],
      ['enable-plugin', pm.enablePlugin, ['a'], ['b'], ['b']],
      ['disable-plugin', pm.disablePlugin, ['a'], [], []],
      ['check-for-plugin-updates', pm.checkForUpdates, [], undefined, true],
      [
        'get-plugin-extensions',
        pm.getPluginExtensions,
        ['dashboard'],
        [{ id: 'w' }],
        [{ id: 'w' }],
      ],
      ['reload-plugin', pm.reloadPlugin, ['a'], undefined, true],
      [
        'get-plugin-settings',
        pm.getPluginSettings,
        ['a'],
        { level: 1 },
        { level: 1 },
      ],
      ['uninstall-plugin', pm.uninstallPlugin, ['a'], undefined, true],
      [
        'deactivate-plugin-license',
        lm.deactivateLicense,
        ['a'],
        { ok: 1 },
        { ok: 1 },
      ],
    ] as const)(
      '%s calls the service',
      async (channel, fn, args, returned, data) => {
        vi.mocked(fn).mockResolvedValue(returned as never);

        const result = await getHandler(channel)(mockEvent, ...args);

        expect(fn).toHaveBeenCalledWith(...args);
        expect(result).toEqual({ success: true, data });
      }
    );

    it('execute-plugin-action unpacks the action request', async () => {
      pm.executePluginAction.mockResolvedValue('done');

      const result = await getHandler('execute-plugin-action')(mockEvent, {
        pluginId: 'a',
        actionId: 'restart',
        args: { name: 'web' },
      });

      expect(pm.executePluginAction).toHaveBeenCalledWith('a', 'restart', {
        name: 'web',
      });
      expect(result).toEqual({ success: true, data: 'done' });
    });

    it('set-plugin-settings saves the settings', async () => {
      const result = await getHandler('set-plugin-settings')(mockEvent, {
        pluginId: 'a',
        settings: { level: 2 },
      });

      expect(pm.updatePluginSettings).toHaveBeenCalledWith('a', { level: 2 });
      expect(result).toEqual({ success: true, data: true });
    });

    it('turns service errors into failed results', async () => {
      pm.enablePlugin.mockRejectedValue(new Error('missing dependency'));

      const result = await getHandler('enable-plugin')(mockEvent, 'a');

      expect(result).toEqual({ success: false, error: 'missing dependency' });
    });
  });

  describe('licenses', () => {
    it('refuses license activation and trials while the marketplace is off', async () => {
      vi.stubEnv('MARKETPLACE_ENABLED', '');

      const activate = await getHandler('activate-plugin-license')(mockEvent, {
        pluginId: 'a',
        licenseKey: 'PRO-AAAA-BBBB',
      });
      const trial = await getHandler('start-plugin-trial')(mockEvent, 'a');

      expect(activate.success).toBe(false);
      expect(trial.success).toBe(false);
      expect(mocks.licenseManager.activateLicense).not.toHaveBeenCalled();
      expect(mocks.licenseManager.startTrial).not.toHaveBeenCalled();
    });

    it('activates licenses and starts trials when the marketplace is on', async () => {
      vi.stubEnv('MARKETPLACE_ENABLED', 'true');
      mocks.licenseManager.activateLicense.mockResolvedValue({
        isActive: true,
      });
      mocks.licenseManager.startTrial.mockResolvedValue({
        isTrialActive: true,
      });

      const activate = await getHandler('activate-plugin-license')(mockEvent, {
        pluginId: 'a',
        licenseKey: 'PRO-AAAA-BBBB',
      });
      const trial = await getHandler('start-plugin-trial')(mockEvent, 'a');

      expect(mocks.licenseManager.activateLicense).toHaveBeenCalledWith(
        'a',
        'PRO-AAAA-BBBB'
      );
      expect(activate).toEqual({ success: true, data: { isActive: true } });
      expect(trial).toEqual({ success: true, data: { isTrialActive: true } });
    });
  });

  describe('import-local-plugin', () => {
    it('fails without a window to attach the dialog to', async () => {
      mocks.getMainWindow.mockReturnValue(null);

      const result = await getHandler('import-local-plugin')(mockEvent);

      expect(result).toEqual({ success: false, error: 'No window available' });
      expect(dialog.showOpenDialog).not.toHaveBeenCalled();
    });

    it('returns null when the user cancels the folder picker', async () => {
      mocks.getMainWindow.mockReturnValue({});
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: true,
        filePaths: [],
      });

      const result = await getHandler('import-local-plugin')(mockEvent);

      expect(result).toEqual({ success: true, data: null });
      expect(mocks.pluginManager.importPlugin).not.toHaveBeenCalled();
    });

    it('imports the chosen folder', async () => {
      mocks.getMainWindow.mockReturnValue({});
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: ['/home/me/my-plugin'],
      });
      mocks.pluginManager.importPlugin.mockResolvedValue('my-plugin');

      const result = await getHandler('import-local-plugin')(mockEvent);

      expect(mocks.pluginManager.importPlugin).toHaveBeenCalledWith(
        '/home/me/my-plugin'
      );
      expect(result).toEqual({ success: true, data: 'my-plugin' });
    });
  });

  describe('generate-plugin validation', () => {
    const generate = (options: unknown) =>
      getHandler('generate-plugin')(mockEvent, options);
    const valid = {
      id: 'my-plugin',
      name: 'Mine',
      author: 'Me',
      description: 'Mine',
    };

    it('rejects an invalid plugin id', async () => {
      const result = await generate({ ...valid, id: '../escape' });

      expect(result.success).toBe(false);
      expect(templateService.scaffoldPlugin).not.toHaveBeenCalled();
    });

    it.each(['name', 'author', 'description'])(
      'rejects a non-string %s',
      async (field) => {
        const result = await generate({ ...valid, [field]: 42 });

        expect(result).toEqual({
          success: false,
          error: `Invalid plugin ${field}`,
        });
      }
    );

    it('refuses to overwrite an existing plugin folder', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValueOnce(true);

      const result = await generate(valid);

      expect(result).toEqual({
        success: false,
        error: 'A plugin with id "my-plugin" already exists',
      });
    });
  });

  describe('plugin id validation', () => {
    it.each([
      'enable-plugin',
      'disable-plugin',
      'reload-plugin',
      'get-plugin-settings',
      'uninstall-plugin',
      'deactivate-plugin-license',
    ])(
      '%s rejects ids that could leave the plugins folder',
      async (channel) => {
        for (const bad of ['../../plugins', '', '.', 'a/b', 42, null]) {
          const result = await getHandler(channel)(mockEvent, bad);
          expect(result.success).toBe(false);
          expect(result.error).toMatch(/Invalid plugin ID/);
        }
        expect(mocks.pluginManager.uninstallPlugin).not.toHaveBeenCalled();
        expect(mocks.pluginManager.enablePlugin).not.toHaveBeenCalled();
      }
    );

    it('validates the id inside request objects too', async () => {
      const settings = await getHandler('set-plugin-settings')(mockEvent, {
        pluginId: '../x',
        settings: {},
      });
      const action = await getHandler('execute-plugin-action')(mockEvent, {
        pluginId: '..',
        actionId: 'a',
      });

      expect(settings.success).toBe(false);
      expect(action.success).toBe(false);
      expect(mocks.pluginManager.updatePluginSettings).not.toHaveBeenCalled();
      expect(mocks.pluginManager.executePluginAction).not.toHaveBeenCalled();
    });
  });
});
