/**
 * Tool IPC Handlers
 *
 * Detection of the CLI tools Shoal shells out to (kubectl, helm, kind, k3d,
 * docker, podman, kompose...). See services/tools/tool-service.ts.
 */

import { ipcMain } from 'electron';
import { toolService } from '../services/tools/tool-service';
import { wrapIpcHandler } from './ipc-utils';

export function registerToolIpcHandlers(): void {
  // Legacy boolean check: fails when the tool is not installed.
  ipcMain.handle(
    'check-tool',
    wrapIpcHandler('check-tool', async (_event, tool) => {
      const status = await toolService.getToolStatus(String(tool));
      if (!status.installed) throw new Error(`${tool} is not installed`);
      return true;
    })
  );

  ipcMain.handle(
    'get-tool-status',
    wrapIpcHandler('get-tool-status', async (_event, tool) => {
      return await toolService.getToolStatus(String(tool));
    })
  );
}
