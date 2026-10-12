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
  ipcMain.handle(
    'get-tool-status',
    wrapIpcHandler('get-tool-status', async (_event, tool) => {
      return await toolService.getToolStatus(String(tool));
    })
  );
}
