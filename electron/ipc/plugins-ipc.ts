/**
 * Plugin System IPC Handlers
 *
 * Covers: plugin lifecycle (enable/disable/reload/uninstall/import),
 * settings, extensions, actions, and license management.
 */

import { ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { pluginManager } from '../services/plugins/plugin-manager';
import { pluginEventBus } from '../services/plugins/plugin-events';
import { templateService } from '../services/plugins/template-service';
import { pathService } from '../services/plugins/path-service';
import { assertValidPluginId } from '../services/plugins/plugin-validator';
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

  // Every handler that takes a plugin id validates it first: the ids end up
  // in file system paths (plugin directories, settings, uninstall).
  ipcMain.handle(
    'enable-plugin',
    wrapIpcHandler('enable-plugin', async (_event, pluginId: unknown) => {
      assertValidPluginId(pluginId);
      return await pluginManager.enablePlugin(pluginId);
    })
  );

  ipcMain.handle(
    'disable-plugin',
    wrapIpcHandler('disable-plugin', async (_event, pluginId: unknown) => {
      assertValidPluginId(pluginId);
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
        assertValidPluginId(options?.id);
        for (const field of ['name', 'author', 'description'] as const) {
          if (typeof options[field] !== 'string') {
            throw new Error(`Invalid plugin ${field}`);
          }
        }
        const pluginDir = path.join(
          pathService.getUserPluginsDir(),
          options.id
        );
        if (
          fs.existsSync(pluginDir) ||
          (await pathService.isBundledPluginId(options.id))
        ) {
          throw new Error(`A plugin with id "${options.id}" already exists`);
        }
        await templateService.scaffoldPlugin(pluginDir, options);
        return true;
      }
    )
  );

  ipcMain.handle(
    'reload-plugin',
    wrapIpcHandler('reload-plugin', async (_event, pluginId: unknown) => {
      assertValidPluginId(pluginId);
      await pluginManager.reloadPlugin(pluginId);
      return true;
    })
  );

  ipcMain.handle(
    'execute-plugin-action',
    wrapIpcHandler(
      'execute-plugin-action',
      async (_event, { pluginId, actionId, args }) => {
        assertValidPluginId(pluginId);
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
    wrapIpcHandler('get-plugin-settings', async (_event, pluginId: unknown) => {
      assertValidPluginId(pluginId);
      return pluginManager.getPluginSettings(pluginId);
    })
  );

  ipcMain.handle(
    'set-plugin-settings',
    wrapIpcHandler(
      'set-plugin-settings',
      async (_event, { pluginId, settings }) => {
        assertValidPluginId(pluginId);
        await pluginManager.updatePluginSettings(pluginId, settings);
        return true;
      }
    )
  );

  ipcMain.handle(
    'uninstall-plugin',
    wrapIpcHandler('uninstall-plugin', async (_event, pluginId: unknown) => {
      assertValidPluginId(pluginId);
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
        assertValidPluginId(pluginId);
        return await licenseManager.activateLicense(pluginId, licenseKey);
      }
    )
  );

  ipcMain.handle(
    'start-plugin-trial',
    wrapIpcHandler('start-plugin-trial', async (_event, pluginId: unknown) => {
      assertMarketplaceEnabled();
      assertValidPluginId(pluginId);
      return await licenseManager.startTrial(pluginId);
    })
  );

  ipcMain.handle(
    'deactivate-plugin-license',
    wrapIpcHandler(
      'deactivate-plugin-license',
      async (_event, pluginId: unknown) => {
        assertValidPluginId(pluginId);
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
