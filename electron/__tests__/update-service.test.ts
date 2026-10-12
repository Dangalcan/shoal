import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  UpdateService,
  type UpdaterLike,
} from '../services/update/update-service';
import { isProduction } from '../utils/env-utils';

vi.mock('../utils/env-utils', () => ({ isProduction: vi.fn() }));

/** A fake updater that records listeners so tests can fire events. */
function makeUpdater() {
  const listeners = new Map<string, (...a: unknown[]) => void>();
  const updater: UpdaterLike & {
    fire: (e: string, ...a: unknown[]) => void;
  } = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
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
});
