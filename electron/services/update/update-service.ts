/**
 * Update Service
 *
 * Thin wrapper around electron-updater's autoUpdater. Emits a normalized
 * UpdateStatus so the renderer can show progress and prompt a restart. The
 * updater is injected so the logic is unit-testable without Electron.
 */

import { getErrorMessage } from '../../utils/error-utils';
import { isProduction } from '../../utils/env-utils';
import log from '../../logger';

export type UpdateStatus =
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string };

/**
 * What a manual update check did: 'started' (results arrive as UpdateStatus
 * events), 'portable' (the Windows portable build cannot update itself),
 * 'dev' (not a packaged build) or 'error' (the updater threw; an 'error'
 * status was emitted too).
 */
export type UpdateCheckStart = 'started' | 'portable' | 'dev' | 'error';

/** Minimal structural view of electron-updater's autoUpdater (for testing). */
export interface UpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  logger: unknown;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(): void;
}

export class UpdateService {
  private onStatus?: (s: UpdateStatus) => void;
  private wired = false;

  constructor(private readonly updater: UpdaterLike) {}

  /** Attach listeners and set the status sink. Idempotent. */
  init(onStatus: (s: UpdateStatus) => void): void {
    this.onStatus = onStatus;
    if (this.wired) return;
    this.wired = true;

    this.updater.autoDownload = true;
    this.updater.autoInstallOnAppQuit = true;
    this.updater.logger = log;

    this.updater.on('checking-for-update', () =>
      this.emit({ state: 'checking' })
    );
    this.updater.on('update-available', (info) =>
      this.emit({ state: 'available', version: versionOf(info) })
    );
    this.updater.on('update-not-available', () =>
      this.emit({ state: 'not-available' })
    );
    this.updater.on('download-progress', (p) =>
      this.emit({ state: 'downloading', percent: percentOf(p) })
    );
    this.updater.on('update-downloaded', (info) =>
      this.emit({ state: 'downloaded', version: versionOf(info) })
    );
    this.updater.on('error', (err) =>
      this.emit({ state: 'error', message: getErrorMessage(err) })
    );
  }

  /**
   * Check for updates. Says why when it does not: outside packaged builds
   * (unless forced; electron-updater cannot run against a dev build) and in
   * the Windows portable build, which cannot replace itself (the updater
   * would install a separate NSIS copy). An updater failure is also reported
   * through the status sink.
   */
  async checkForUpdates(force = false): Promise<UpdateCheckStart> {
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      log.info(
        '[UpdateService] Skipping update check (portable build cannot self-update)'
      );
      return 'portable';
    }
    if (!isProduction() && !force) {
      log.info('[UpdateService] Skipping update check (not a packaged build)');
      return 'dev';
    }
    try {
      await this.updater.checkForUpdates();
      return 'started';
    } catch (err: unknown) {
      this.emit({ state: 'error', message: getErrorMessage(err) });
      return 'error';
    }
  }

  /** Quit and install a downloaded update. */
  quitAndInstall(): void {
    this.updater.quitAndInstall();
  }

  private emit(s: UpdateStatus): void {
    this.onStatus?.(s);
  }
}

function versionOf(info: unknown): string {
  return (info as { version?: string })?.version ?? 'unknown';
}
function percentOf(p: unknown): number {
  const pct = (p as { percent?: number })?.percent ?? 0;
  return Math.max(0, Math.min(100, Math.round(pct)));
}
