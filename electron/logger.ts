/**
 * Electron Main-Process Logger
 *
 * Wraps electron-log to provide structured, levelled logging that writes to:
 *   Windows : %APPDATA%\{appName}\logs\main.log
 *   macOS   : ~/Library/Logs/{appName}/main.log
 *   Linux   : ~/.config/{appName}/logs/main.log
 *
 * Log levels in order of severity: error > warn > info > verbose > debug > silly
 * The file gets info and above (dev and packaged); the console also gets
 * debug output outside packaged builds.
 *
 * Crash capture (Electron runtime only): uncaught exceptions and unhandled
 * rejections in the main process, and render/child process crashes, failed
 * loads and unresponsive windows are written to the same file. Renderer errors
 * arrive through the `log-renderer-error` IPC (ipc/app-ipc.ts). Nothing leaves
 * the machine; users attach the log to a GitHub issue themselves.
 */

import path from 'path';
import { app } from 'electron';
import log from 'electron-log/main';

// Initialise file transport (must be called once in the main process)
log.initialize();

log.transports.file.level = 'info';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB, then rotate

// NODE_ENV is unset in packaged builds, so ask Electron instead.
const isDev = !app?.isPackaged;
log.transports.console.level = isDev ? 'debug' : 'info';

// Keep the [ServiceName] prefix format already used throughout the codebase
log.transports.console.format = '{text}';
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

// Only inside Electron: under Vitest these hooks would swallow test failures.
if (process.versions.electron) {
  log.errorHandler.startCatching({ showDialog: false });
  log.eventLogger.startLogging();
}

/** Directory holding main.log (and its rotated copies). */
export function getLogsDirectory(): string {
  return path.dirname(log.transports.file.getFile().path);
}

export default log;
