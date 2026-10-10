/**
 * Plugin System IPC Handlers
 *
 * Covers: plugin lifecycle (enable/disable/reload/uninstall/import),
 * settings, extensions, actions, and license management.
 */

import { ipcMain, app, dialog } from 'electron';
import path from 'path';
import { pluginManager } from '../services/plugins/plugin-manager';
import { pluginEventBus } from '../services/plugins/plugin-events';
import { templateService } from '../services/plugins/template-service';
import { licenseManager } from '../services/security/license-manager';
import type { PluginScaffoldOptions } from '../types/plugin-types';
import { wrapIpcHandler } from './ipc-utils';
import { assertMarketplaceEnabled } from '../utils/env-utils';

export function registerPluginsIpcHandlers(): void {
  ipcMain.handle(
    'get-plugins',
    wrapIpcHandler('get-plugins', async () => {
      return pluginManager.getPlugins();
    })
  );

  ipcMain.handle(
    'enable-plugin',
    wrapIpcHandler('enable-plugin', async (_event, pluginId: string) => {
      return await pluginManager.enablePlugin(pluginId);
    })
  );

  ipcMain.handle(
    'disable-plugin',
    wrapIpcHandler('disable-plugin', async (_event, pluginId: string) => {
      return await pluginManager.disablePlugin(pluginId);
    })
  );

  ipcMain.handle(
    'check-for-plugin-updates',
    wrapIpcHandler('check-for-plugin-updates', async () => {
      await pluginManager.checkForUpdates();
      return true;
    })
  );

  ipcMain.handle(
    'get-plugin-extensions',
    wrapIpcHandler(
      'get-plugin-extensions',
      async (_event, extensionPoint?: string) => {
        return pluginManager.getPluginExtensions(extensionPoint);
      }
    )
  );

  ipcMain.handle(
    'generate-plugin',
    wrapIpcHandler(
      'generate-plugin',
      async (_event, options: PluginScaffoldOptions) => {
        const pluginDir = path.join(
          app.getPath('userData'),
          'plugins',
          options.id
        );
        await templateService.scaffoldPlugin(pluginDir, options);
        return true;
      }
    )
  );

  ipcMain.handle(
    'reload-plugin',
    wrapIpcHandler('reload-plugin', async (_event, pluginId: string) => {
      await pluginManager.reloadPlugin(pluginId);
      return true;
    })
  );

  ipcMain.handle(
    'execute-plugin-action',
    wrapIpcHandler(
      'execute-plugin-action',
      async (_event, { pluginId, actionId, args }) => {
        return await pluginManager.executePluginAction(
          pluginId,
          actionId,
          args
        );
      }
    )
  );

  ipcMain.handle(
    'get-plugin-settings',
    wrapIpcHandler('get-plugin-settings', async (_event, pluginId: string) => {
      return pluginManager.getPluginSettings(pluginId);
    })
  );

  ipcMain.handle(
    'set-plugin-settings',
    wrapIpcHandler(
      'set-plugin-settings',
      async (_event, { pluginId, settings }) => {
        await pluginManager.updatePluginSettings(pluginId, settings);
        return true;
      }
    )
  );

  ipcMain.handle(
    'uninstall-plugin',
    wrapIpcHandler('uninstall-plugin', async (_event, pluginId: string) => {
      await pluginManager.uninstallPlugin(pluginId);
      return true;
    })
  );

  ipcMain.handle(
    'activate-plugin-license',
    wrapIpcHandler(
      'activate-plugin-license',
      async (_event, { pluginId, licenseKey }) => {
        assertMarketplaceEnabled();
        return await licenseManager.activateLicense(pluginId, licenseKey);
      }
    )
  );

  ipcMain.handle(
    'start-plugin-trial',
    wrapIpcHandler('start-plugin-trial', async (_event, pluginId: string) => {
      assertMarketplaceEnabled();
      return await licenseManager.startTrial(pluginId);
    })
  );

  ipcMain.handle(
    'deactivate-plugin-license',
    wrapIpcHandler(
      'deactivate-plugin-license',
      async (_event, pluginId: string) => {
        return await licenseManager.deactivateLicense(pluginId);
      }
    )
  );

  ipcMain.handle(
    'import-local-plugin',
    wrapIpcHandler('import-local-plugin', async () => {
      const win = pluginEventBus.getMainWindow();
      if (!win) throw new Error('No window available');

      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: 'Select Plugin Directory',
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: 'Import Plugin',
      });

      if (canceled || filePaths.length === 0) return null;

      return await pluginManager.importPlugin(filePaths[0]);
    })
  );
}
