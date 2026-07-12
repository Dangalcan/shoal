/**
 * Marketplace IPC Handlers
 *
 * Covers: fetching marketplace listings and installing plugins.
 */

import { ipcMain } from 'electron';
import { marketplaceService } from '../services/marketplace/marketplace-service';
import { wrapIpcHandler } from './ipc-utils';

export function registerMarketplaceIpcHandlers(): void {
  ipcMain.handle(
    'get-marketplace-plugins',
    wrapIpcHandler('get-marketplace-plugins', async () => {
      return await marketplaceService.getMarketplacePlugins();
    })
  );

  ipcMain.handle(
    'install-plugin',
    wrapIpcHandler('install-plugin', async (_event, pluginId: string) => {
      return await marketplaceService.installPlugin(pluginId);
    })
  );

  ipcMain.handle(
    'create-checkout',
    wrapIpcHandler('create-checkout', async (_event, pluginId: string) => {
      return await marketplaceService.createCheckout(pluginId);
    })
  );

  ipcMain.handle(
    'get-checkout-status',
    wrapIpcHandler('get-checkout-status', async (_event, sessionId: string) => {
      return await marketplaceService.getCheckoutStatus(sessionId);
    })
  );
}
