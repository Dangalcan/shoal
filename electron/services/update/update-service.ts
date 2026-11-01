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
 * 'package' (installed from a Linux package, which the package manager
 * updates), 'dev' (not a packaged build) or 'error' (the updater threw; an
 * 'error' status was emitted too).
 */
export type UpdateCheckStart =
  'started' | 'portable' | 'package' | 'dev' | 'error';

/** Minimal structural view of electron-updater's autoUpdater (for testing). */
export interface UpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  /** Whether a check may pick a pre-release; set per check, see runCheck. */
  allowPrerelease: boolean;
  /** The running version as electron-updater parsed it. */
  readonly currentVersion: {
    readonly prerelease: ReadonlyArray<string | number>;
  };
  logger: unknown;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(): void;
}

/**
 * electron-updater's GitHub provider raises these when the stable lookup
 * (`/releases/latest`) finds nothing: the repository has no published
 * release that is not a pre-release. The lookup wraps every failure in the
 * first code, so a network error ends up here too; the retry with
 * pre-releases then reports the real cause.
 */
const NO_STABLE_RELEASE_CODES = new Set([
  'ERR_UPDATER_LATEST_VERSION_NOT_FOUND',
  'ERR_UPDATER_NO_PUBLISHED_VERSIONS',
]);

/**
 * The provider runs that lookup inside the try/catch that parses the
 * releases feed (GitHubProvider.getLatestVersion, 6.8.9 and 6.8.11), so the
 * codes above never reach us directly: they arrive wrapped in
 * ERR_UPDATER_INVALID_RELEASE_FEED with the original message inside
 * ("Cannot parse releases feed: Error: Unable to find latest version on
 * GitHub (.../releases/latest), please ensure a production release exists:
 * HttpError: 406 ..."). An installed 0.9.0-rc.4 showed this on 28 October
 * 2026: the stable probe failed, nothing fell back to pre-releases, and the
 * check ended in an error instead of offering rc.5.
 */
const WRAPPING_CODE = 'ERR_UPDATER_INVALID_RELEASE_FEED';
const NO_STABLE_RELEASE_MESSAGE =
  /Unable to find latest version on GitHub|please ensure a production release exists|No published versions on GitHub/;

function isNoStableRelease(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null;
  const code = e?.code;
  if (typeof code !== 'string') return false;
  if (NO_STABLE_RELEASE_CODES.has(code)) return true;
  return (
    code === WRAPPING_CODE &&
    typeof e?.message === 'string' &&
    NO_STABLE_RELEASE_MESSAGE.test(e.message)
  );
}

export class UpdateService {
  private onStatus?: (s: UpdateStatus) => void;
  private wired = false;
  private lastStatus: UpdateStatus | null = null;
  /** True while a pre-release build probes the stable channel (runCheck). */
  private probingStable = false;

  constructor(private readonly updater: UpdaterLike) {}

  /**
   * The most recent status, for a renderer that mounts (or reloads) after
   * the event was sent. Null until the first check reports anything.
   */
  getStatus(): UpdateStatus | null {
    return this.lastStatus;
  }

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
    this.updater.on('error', (err) => {
      // The stable probe of a pre-release build is allowed to find nothing:
      // runCheck retries with pre-releases, so this is not an error yet.
      if (this.probingStable && isNoStableRelease(err)) return;
      this.emit({ state: 'error', message: getErrorMessage(err) });
    });
  }

  /**
   * Check for updates. Says why when it does not: outside packaged builds
   * (unless forced; electron-updater cannot run against a dev build), in
   * the Windows portable build, which cannot replace itself (the updater
   * would install a separate NSIS copy), and in a Linux install that did not
   * come from the AppImage (the .deb), which the package manager updates.
   * An updater failure is also reported through the status sink.
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
    if (process.platform === 'linux' && !process.env.APPIMAGE) {
      log.info(
        '[UpdateService] Skipping update check (installed from a package, not the AppImage)'
      );
      return 'package';
    }
    try {
      await this.runCheck();
      return 'started';
    } catch (err: unknown) {
      this.emit({ state: 'error', message: getErrorMessage(err) });
      return 'error';
    }
  }

  /**
   * Runs the check against the stable channel first, and only falls back to
   * pre-releases when the running build is itself a pre-release and no
   * stable release exists yet.
   *
   * electron-updater turns `allowPrerelease` on by itself for a pre-release
   * build, and its GitHub provider then only follows releases of the same
   * pre-release channel: a `0.9.0-rc.3` build would skip `v0.9.0` and stay
   * on `rc.3` for good. Asking for the stable release first gives every
   * pre-release build the next stable version as soon as it is published;
   * until then, release candidates still update to the next candidate. A
   * stable build never looks at pre-releases.
   */
  private async runCheck(): Promise<void> {
    this.updater.allowPrerelease = false;
    if (this.updater.currentVersion.prerelease.length === 0) {
      await this.updater.checkForUpdates();
      return;
    }
    this.probingStable = true;
    try {
      await this.updater.checkForUpdates();
      return;
    } catch (err: unknown) {
      if (!isNoStableRelease(err)) throw err;
      log.info(
        '[UpdateService] No stable release published yet; checking pre-releases'
      );
    } finally {
      this.probingStable = false;
    }
    this.updater.allowPrerelease = true;
    await this.updater.checkForUpdates();
  }

  /** Quit and install a downloaded update. */
  quitAndInstall(): void {
    this.updater.quitAndInstall();
  }

  private emit(s: UpdateStatus): void {
    this.lastStatus = s;
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
