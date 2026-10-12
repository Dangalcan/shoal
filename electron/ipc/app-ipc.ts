/**
 * App IPC Handlers
 *
 * About & Support: app/runtime information, opening the logs folder, and
 * writing renderer errors to the main log file.
 */

import { ipcMain, app, shell } from 'electron';
import log, { getLogsDirectory } from '../logger';
import { wrapIpcHandler } from './ipc-utils';
import type { AppInfo, RendererErrorReport } from '../types/app-types';

const MAX_REPORT_FIELD = 4000;

function clip(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_REPORT_FIELD) : '';
}

export function registerAppIpcHandlers(): void {
  ipcMain.handle(
    'get-app-info',
    wrapIpcHandler('get-app-info', async (): Promise<AppInfo> => ({
      version: `v${app.getVersion()}`,
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron ?? '',
      logsPath: getLogsDirectory(),
    }))
  );

  ipcMain.handle(
    'open-logs-folder',
    wrapIpcHandler('open-logs-folder', async () => {
      // shell.openPath resolves with an error message instead of throwing.
      const error = await shell.openPath(getLogsDirectory());
      if (error) throw new Error(error);
      return true;
    })
  );

  ipcMain.handle(
    'log-renderer-error',
    wrapIpcHandler(
      'log-renderer-error',
      async (_event, report: RendererErrorReport) => {
        const source = clip(report?.source) || 'renderer';
        const message = clip(report?.message) || 'Unknown error';
        const stack = clip(report?.stack);
        log.error(
          `[Renderer:${source}] ${message}${stack ? `\n${stack}` : ''}`
        );
        return true;
      }
    )
  );
}
