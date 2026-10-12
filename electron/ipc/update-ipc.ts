/**
 * App Update IPC Handlers
 *
 * Lets the renderer trigger a manual update check and install a downloaded
 * update. Update status is pushed to the window from main.ts via the
 * 'update-status' channel.
 */

import { ipcMain } from 'electron';
import { updateService } from '../services/update';
import { wrapIpcHandler } from './ipc-utils';

export function registerUpdateIpcHandlers(): void {
  ipcMain.handle(
    'check-for-updates',
    wrapIpcHandler('check-for-updates', async () => {
      // Development builds get 'dev' back (the About card says so) instead
      // of a forced check: electron-updater resolves to null without any
      // event when the app is not packaged, which left the button spinning.
      return await updateService.checkForUpdates();
    })
  );

  ipcMain.handle(
    'install-update',
    wrapIpcHandler('install-update', async () => {
      updateService.quitAndInstall();
      return true;
    })
  );
}
