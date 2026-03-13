/**
 * Electron Main-Process Logger
 *
 * Wraps electron-log to provide structured, levelled logging that writes to:
 *   Windows : %APPDATA%\{appName}\logs\main.log
 *   macOS   : ~/Library/Logs/{appName}/main.log
 *   Linux   : ~/.config/{appName}/logs/main.log
 *
 * Log levels in order of severity: error > warn > info > verbose > debug > silly
 * Only error/warn are written to file in production; all levels in development.
 */

import log from 'electron-log/main';

// Initialise file transport (must be called once in the main process)
log.initialize();

// File transport — always write warn and above
log.transports.file.level = 'info';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB, then rotate

// Console transport — verbose in dev, warn-only in production
const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
log.transports.console.level = isDev ? 'debug' : 'info';

// Keep the [ServiceName] prefix format already used throughout the codebase
log.transports.console.format = '{text}';
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

export default log;
