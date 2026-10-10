/**
 * Marketplace IPC Handlers
 *
 * Covers: fetching marketplace listings and installing plugins.
 * Every handler is refused while the marketplace is disabled
 * (MARKETPLACE_ENABLED, see utils/env-utils.ts).
 */

import { ipcMain } from 'electron';
import { marketplaceService } from '../services/marketplace/marketplace-service';
import { wrapIpcHandler } from './ipc-utils';
import { assertMarketplaceEnabled } from '../utils/env-utils';

export function registerMarketplaceIpcHandlers(): void {
  ipcMain.handle(
    'get-marketplace-plugins',
    wrapIpcHandler('get-marketplace-plugins', async () => {
      assertMarketplaceEnabled();
      return await marketplaceService.getMarketplacePlugins();
    })
  );

  ipcMain.handle(
    'install-plugin',
    wrapIpcHandler('install-plugin', async (_event, pluginId: string) => {
      assertMarketplaceEnabled();
      return await marketplaceService.installPlugin(pluginId);
    })
  );

  ipcMain.handle(
    'create-checkout',
    wrapIpcHandler('create-checkout', async (_event, pluginId: string) => {
      assertMarketplaceEnabled();
      return await marketplaceService.createCheckout(pluginId);
    })
  );

  ipcMain.handle(
    'get-checkout-status',
    wrapIpcHandler('get-checkout-status', async (_event, sessionId: string) => {
      assertMarketplaceEnabled();
      return await marketplaceService.getCheckoutStatus(sessionId);
    })
  );
}
