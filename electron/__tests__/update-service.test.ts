import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  UpdateService,
  type UpdaterLike,
} from '../services/update/update-service';
import { isProduction } from '../utils/env-utils';

vi.mock('../utils/env-utils', () => ({ isProduction: vi.fn() }));

/**
 * A fake updater that records listeners so tests can fire events. The
 * running version is stable unless `prerelease` says otherwise.
 */
function makeUpdater(prerelease: ReadonlyArray<string | number> = []) {
  const listeners = new Map<string, (...a: unknown[]) => void>();
  const updater: UpdaterLike & {
    fire: (e: string, ...a: unknown[]) => void;
  } = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowPrerelease: true,
    currentVersion: { prerelease },
    logger: null,
    on: vi.fn((event: string, cb: (...a: unknown[]) => void) => {
      listeners.set(event, cb);
      return updater;
    }),
    checkForUpdates: vi.fn().mockResolvedValue({}),
    quitAndInstall: vi.fn(),
    fire: (event: string, ...args: unknown[]) =>
      listeners.get(event)?.(...args),
  };
  return updater;
}

describe('UpdateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // A Linux runner without APPIMAGE looks like a package install, which
    // never checks for updates: pretend the AppImage launcher set it.
    vi.stubEnv('APPIMAGE', '/opt/Shoal.AppImage');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('wires updater options and maps events to normalized statuses', () => {
    const updater = makeUpdater();
    const svc = new UpdateService(updater);
    const statuses: unknown[] = [];
    svc.init((s) => statuses.push(s));

    expect(updater.autoDownload).toBe(true);
    expect(updater.autoInstallOnAppQuit).toBe(true);

    updater.fire('checking-for-update');
    updater.fire('update-available', { version: '2.0.0' });
    updater.fire('download-progress', { percent: 42.7 });
    updater.fire('update-downloaded', { version: '2.0.0' });
    updater.fire('update-not-available');
    updater.fire('error', new Error('boom'));

    expect(statuses).toEqual([
      { state: 'checking' },
      { state: 'available', version: '2.0.0' },
      { state: 'downloading', percent: 43 },
      { state: 'downloaded', version: '2.0.0' },
      { state: 'not-available' },
      { state: 'error', message: 'boom' },
    ]);
  });

  it('is idempotent — init twice does not double-register', () => {
    const updater = makeUpdater();
    const svc = new UpdateService(updater);
    svc.init(() => {});
    svc.init(() => {});
    // 6 distinct events registered exactly once each.
    expect((updater.on as ReturnType<typeof vi.fn>).mock.calls.length).toBe(6);
  });

  it('skips the check outside packaged builds unless forced', async () => {
    vi.mocked(isProduction).mockReturnValue(false);
    const updater = makeUpdater();
    const svc = new UpdateService(updater);

    expect(await svc.checkForUpdates()).toBe('dev');
    expect(updater.checkForUpdates).not.toHaveBeenCalled();

    expect(await svc.checkForUpdates(true)).toBe('started');
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('reports an updater failure as error through the status sink too', async () => {
    vi.mocked(isProduction).mockReturnValue(true);
    const updater = makeUpdater();
    updater.checkForUpdates = vi.fn().mockRejectedValue(new Error('offline'));
    const svc = new UpdateService(updater);
    const onStatus = vi.fn();
    svc.init(onStatus);

    expect(await svc.checkForUpdates()).toBe('error');
    expect(onStatus).toHaveBeenCalledWith({
      state: 'error',
      message: 'offline',
    });
  });

  it('never checks in the Windows portable build, even when forced', async () => {
    vi.mocked(isProduction).mockReturnValue(true);
    vi.stubEnv('PORTABLE_EXECUTABLE_DIR', 'C:\\Users\\me\\Downloads');
    try {
      const updater = makeUpdater();
      const svc = new UpdateService(updater);
      expect(await svc.checkForUpdates()).toBe('portable');
      expect(await svc.checkForUpdates(true)).toBe('portable');
      expect(updater.checkForUpdates).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('fills in a missing version and progress, and clamps the percentage', () => {
    const updater = makeUpdater();
    const svc = new UpdateService(updater);
    const statuses: unknown[] = [];
    svc.init((s) => statuses.push(s));

    updater.fire('update-available', undefined);
    updater.fire('update-downloaded', {});
    updater.fire('download-progress', null);
    updater.fire('download-progress', { percent: 140 });
    updater.fire('download-progress', { percent: -3 });

    expect(statuses).toEqual([
      { state: 'available', version: 'unknown' },
      { state: 'downloaded', version: 'unknown' },
      { state: 'downloading', percent: 0 },
      { state: 'downloading', percent: 100 },
      { state: 'downloading', percent: 0 },
    ]);
  });

  it('remembers the last status for late subscribers', () => {
    const updater = makeUpdater();
    const svc = new UpdateService(updater);
    expect(svc.getStatus()).toBeNull();
    svc.init(() => {});
    updater.fire('update-downloaded', { version: '2.0.0' });
    expect(svc.getStatus()).toEqual({ state: 'downloaded', version: '2.0.0' });
  });

  it('never checks in a Linux package install (not the AppImage)', async () => {
    vi.mocked(isProduction).mockReturnValue(true);
    const platform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'linux' });
    vi.stubEnv('APPIMAGE', '');
    try {
      const updater = makeUpdater();
      const svc = new UpdateService(updater);
      expect(await svc.checkForUpdates()).toBe('package');
      expect(updater.checkForUpdates).not.toHaveBeenCalled();

      vi.stubEnv('APPIMAGE', '/home/me/Shoal.AppImage');
      expect(await svc.checkForUpdates()).toBe('started');
      expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllEnvs();
      if (platform) Object.defineProperty(process, 'platform', platform);
    }
  });

  it('runs the check in packaged builds', async () => {
    vi.mocked(isProduction).mockReturnValue(true);
    const updater = makeUpdater();
    const svc = new UpdateService(updater);
    expect(await svc.checkForUpdates()).toBe('started');
    expect(updater.checkForUpdates).toHaveBeenCalled();
  });

  it('reports an error status when the check throws', async () => {
    vi.mocked(isProduction).mockReturnValue(true);
    const updater = makeUpdater();
    updater.checkForUpdates = vi.fn().mockRejectedValue(new Error('net down'));
    const svc = new UpdateService(updater);
    const statuses: unknown[] = [];
    svc.init((s) => statuses.push(s));

    expect(await svc.checkForUpdates()).toBe('error');
    expect(statuses).toContainEqual({ state: 'error', message: 'net down' });
  });

  it('delegates quitAndInstall to the updater', () => {
    const updater = makeUpdater();
    const svc = new UpdateService(updater);
    svc.quitAndInstall();
    expect(updater.quitAndInstall).toHaveBeenCalled();
  });

  describe('channels', () => {
    /**
     * What electron-updater raises when `/releases/latest` finds nothing:
     * the GitHub provider's ERR_UPDATER_LATEST_VERSION_NOT_FOUND, wrapped by
     * its feed parser in ERR_UPDATER_INVALID_RELEASE_FEED with the original
     * message inside (6.8.9 and 6.8.11, GitHub answers 406).
     */
    function noStableRelease() {
      const err = new Error(
        'Cannot parse releases feed: Error: Unable to find latest version on GitHub (https://github.com/Dangalcan/shoal/releases/latest), please ensure a production release exists: HttpError: 406 Not Acceptable,\nXML:\n<feed/>'
      );
      (err as Error & { code: string }).code =
        'ERR_UPDATER_INVALID_RELEASE_FEED';
      return err;
    }

    /** The inner error on its own, in case a provider ever raises it bare. */
    function bareNoStableRelease() {
      const err = new Error('Unable to find latest version on GitHub');
      (err as Error & { code: string }).code =
        'ERR_UPDATER_LATEST_VERSION_NOT_FOUND';
      return err;
    }

    /** A feed error that has nothing to do with a missing stable release. */
    function brokenFeed() {
      const err = new Error(
        'Cannot parse releases feed: Error: Unexpected token < in JSON,\nXML:\n<feed/>'
      );
      (err as Error & { code: string }).code =
        'ERR_UPDATER_INVALID_RELEASE_FEED';
      return err;
    }

    /**
     * Rejects like electron-updater's checkForUpdates: it emits 'error'
     * before the promise rejects.
     */
    function rejectingCheck(
      updater: ReturnType<typeof makeUpdater>,
      err: Error
    ) {
      return async () => {
        updater.fire('error', err);
        throw err;
      };
    }

    beforeEach(() => vi.mocked(isProduction).mockReturnValue(true));

    it('a stable build only looks at stable releases', async () => {
      const updater = makeUpdater([]);
      const svc = new UpdateService(updater);
      svc.init(() => {});

      expect(await svc.checkForUpdates()).toBe('started');
      expect(updater.allowPrerelease).toBe(false);
      expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    });

    it('a stable build reports a missing stable release as an error', async () => {
      const updater = makeUpdater([]);
      updater.checkForUpdates = vi
        .fn()
        .mockImplementation(rejectingCheck(updater, noStableRelease()));
      const svc = new UpdateService(updater);
      const statuses: unknown[] = [];
      svc.init((s) => statuses.push(s));

      expect(await svc.checkForUpdates()).toBe('error');
      expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
      expect(statuses).toContainEqual(
        expect.objectContaining({
          state: 'error',
          message: expect.stringContaining(
            'Unable to find latest version on GitHub'
          ),
        })
      );
    });

    it('a pre-release build takes the stable release when there is one', async () => {
      const updater = makeUpdater(['rc', 3]);
      const svc = new UpdateService(updater);
      svc.init(() => {});

      expect(await svc.checkForUpdates()).toBe('started');
      expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
      expect(updater.allowPrerelease).toBe(false);
    });

    it('a pre-release build falls back to pre-releases when no stable release exists', async () => {
      const updater = makeUpdater(['rc', 2]);
      const seen: boolean[] = [];
      updater.checkForUpdates = vi
        .fn()
        .mockImplementationOnce(async () => {
          seen.push(updater.allowPrerelease);
          await rejectingCheck(updater, noStableRelease())();
        })
        .mockImplementationOnce(async () => {
          seen.push(updater.allowPrerelease);
          return {};
        });
      const svc = new UpdateService(updater);
      const statuses: unknown[] = [];
      svc.init((s) => statuses.push(s));

      expect(await svc.checkForUpdates()).toBe('started');
      expect(seen).toEqual([false, true]);
      expect(statuses).not.toContainEqual(
        expect.objectContaining({ state: 'error' })
      );
    });

    it('a pre-release build reports any other failure of the stable probe', async () => {
      const updater = makeUpdater(['rc', 2]);
      updater.checkForUpdates = vi
        .fn()
        .mockImplementation(rejectingCheck(updater, new Error('bad feed')));
      const svc = new UpdateService(updater);
      const statuses: unknown[] = [];
      svc.init((s) => statuses.push(s));

      expect(await svc.checkForUpdates()).toBe('error');
      expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
      expect(statuses).toContainEqual({ state: 'error', message: 'bad feed' });
    });

    it('a pre-release build reports the failure of the pre-release check', async () => {
      const updater = makeUpdater(['rc', 2]);
      updater.checkForUpdates = vi
        .fn()
        .mockImplementationOnce(rejectingCheck(updater, noStableRelease()))
        .mockImplementationOnce(rejectingCheck(updater, new Error('offline')));
      const svc = new UpdateService(updater);
      const statuses: unknown[] = [];
      svc.init((s) => statuses.push(s));

      expect(await svc.checkForUpdates()).toBe('error');
      expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
      expect(statuses).toContainEqual({ state: 'error', message: 'offline' });
      expect(statuses).not.toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining(
            'Unable to find latest version on GitHub'
          ),
        })
      );
    });

    it('a pre-release build also falls back when the provider raises the bare code', async () => {
      const updater = makeUpdater(['rc', 2]);
      updater.checkForUpdates = vi
        .fn()
        .mockImplementationOnce(rejectingCheck(updater, bareNoStableRelease()))
        .mockImplementationOnce(async () => ({}));
      const svc = new UpdateService(updater);
      const statuses: unknown[] = [];
      svc.init((s) => statuses.push(s));

      expect(await svc.checkForUpdates()).toBe('started');
      expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
      expect(statuses).not.toContainEqual(
        expect.objectContaining({ state: 'error' })
      );
    });

    it('a pre-release build reports a feed error that is not about a missing stable release', async () => {
      const updater = makeUpdater(['rc', 2]);
      updater.checkForUpdates = vi
        .fn()
        .mockImplementation(rejectingCheck(updater, brokenFeed()));
      const svc = new UpdateService(updater);
      const statuses: unknown[] = [];
      svc.init((s) => statuses.push(s));

      expect(await svc.checkForUpdates()).toBe('error');
      expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
      expect(statuses).toContainEqual(
        expect.objectContaining({
          state: 'error',
          message: expect.stringContaining('Unexpected token'),
        })
      );
    });

    it('starts every check from the stable channel again', async () => {
      const updater = makeUpdater(['rc', 2]);
      updater.checkForUpdates = vi
        .fn()
        .mockImplementationOnce(rejectingCheck(updater, noStableRelease()))
        .mockResolvedValue({});
      const svc = new UpdateService(updater);
      svc.init(() => {});

      await svc.checkForUpdates();
      expect(updater.allowPrerelease).toBe(true);
      await svc.checkForUpdates();
      expect(updater.allowPrerelease).toBe(false);
      expect(updater.checkForUpdates).toHaveBeenCalledTimes(3);
    });
  });
});
