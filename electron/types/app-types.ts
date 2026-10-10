/**
 * App Types
 *
 * Shared shapes for the About & Support surface. Imported by both the main
 * process and the renderer (src/types.d.ts): keep free of Electron/Node imports.
 */

/** Runtime facts shown in Settings and put into bug reports. */
export interface AppInfo {
  /** "v" + package.json version, e.g. "v0.9.0". */
  version: string;
  /** process.platform of the main process (win32, linux, darwin). */
  platform: string;
  arch: string;
  electron: string;
  /** Folder that holds main.log. */
  logsPath: string;
}

/** A renderer-side error to be written to the main log file. */
export interface RendererErrorReport {
  /** Where it was caught: "error-boundary", "window-error", "unhandledrejection". */
  source: string;
  message: string;
  stack?: string;
}
