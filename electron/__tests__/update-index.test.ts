/**
 * The app-wide update service is the UpdateService wrapped around
 * electron-updater's autoUpdater singleton.
 */
import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowPrerelease: false,
    currentVersion: { prerelease: [] as Array<string | number> },
    logger: null as unknown,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    quitAndInstall: vi.fn(),
  },
}));

vi.mock('electron-updater', () => ({ autoUpdater: mocks.autoUpdater }));
vi.mock('../logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { updateService, UpdateService } from '../services/update';

describe('services/update', () => {
  it('exports one UpdateService driving the autoUpdater', () => {
    expect(updateService).toBeInstanceOf(UpdateService);

    updateService.quitAndInstall();
    expect(mocks.autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1);

    updateService.init(() => undefined);
    expect(mocks.autoUpdater.autoDownload).toBe(true);
    expect(mocks.autoUpdater.on).toHaveBeenCalledWith(
      'update-downloaded',
      expect.any(Function)
    );
  });
});
