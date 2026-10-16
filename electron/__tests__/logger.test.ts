import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

/**
 * The main-process logger configures electron-log once on import: file and
 * console levels, formats, and (only inside Electron) the crash capture.
 */

const h = vi.hoisted(() => {
  const log = {
    initialize: vi.fn(),
    transports: {
      file: {
        level: '',
        maxSize: 0,
        format: '',
        getFile: vi.fn(() => ({
          path: path.join('/home/ana/.config/Shoal/logs', 'main.log'),
        })),
      },
      console: { level: '', format: '' },
    },
    errorHandler: { startCatching: vi.fn() },
    eventLogger: { startLogging: vi.fn() },
  };
  return { log, isPackaged: false };
});

vi.mock('electron-log/main', () => ({ default: h.log }));
vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return h.isPackaged;
    },
  },
}));

const originalVersions = process.versions;

function setElectronVersion(version: string | undefined): void {
  const versions: Record<string, string | undefined> = { ...originalVersions };
  if (version === undefined) delete versions.electron;
  else versions.electron = version;
  Object.defineProperty(process, 'versions', {
    value: versions,
    configurable: true,
  });
}

async function importLogger() {
  vi.resetModules();
  return import('../logger');
}

describe('logger', () => {
  beforeEach(() => {
    h.log.initialize.mockClear();
    h.log.errorHandler.startCatching.mockClear();
    h.log.eventLogger.startLogging.mockClear();
    h.isPackaged = false;
  });

  afterEach(() => {
    Object.defineProperty(process, 'versions', {
      value: originalVersions,
      configurable: true,
    });
  });

  it('writes info and above to the file and debug to the console in development', async () => {
    setElectronVersion(undefined);
    await importLogger();

    expect(h.log.initialize).toHaveBeenCalledTimes(1);
    expect(h.log.transports.file.level).toBe('info');
    expect(h.log.transports.file.maxSize).toBe(5 * 1024 * 1024);
    expect(h.log.transports.console.level).toBe('debug');
    expect(h.log.transports.file.format).toContain('{level}');
  });

  it('keeps the console at info in packaged builds', async () => {
    setElectronVersion(undefined);
    h.isPackaged = true;
    await importLogger();

    expect(h.log.transports.console.level).toBe('info');
  });

  it('captures crashes only when running inside Electron', async () => {
    setElectronVersion(undefined);
    await importLogger();
    expect(h.log.errorHandler.startCatching).not.toHaveBeenCalled();
    expect(h.log.eventLogger.startLogging).not.toHaveBeenCalled();

    setElectronVersion('44.7.0');
    await importLogger();
    expect(h.log.errorHandler.startCatching).toHaveBeenCalledWith({
      showDialog: false,
    });
    expect(h.log.eventLogger.startLogging).toHaveBeenCalledTimes(1);
  });

  it('reports the folder that holds main.log', async () => {
    setElectronVersion(undefined);
    const { getLogsDirectory } = await importLogger();

    expect(getLogsDirectory()).toBe(
      path.dirname(path.join('/home/ana/.config/Shoal/logs', 'main.log'))
    );
  });
});
