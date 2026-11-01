import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pluginWatcher } from '../services/plugins/plugin-watcher';
import { pluginLoader } from '../services/plugins/plugin-loader';
import fs from 'fs';
import log from '../logger';

vi.mock('../logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
  },
}));

vi.mock('../services/plugins/plugin-loader', () => ({
  pluginLoader: {
    getPluginPath: vi.fn(),
  },
}));

vi.mock('fs', () => ({
  default: {
    watch: vi.fn(),
  },
}));

describe('PluginWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    pluginWatcher.stopAll();
  });

  it('should start watcher and handle change events with debounce', async () => {
    const pluginId = 'p1';
    const pluginPath = '/path/p1';
    vi.mocked(pluginLoader.getPluginPath).mockResolvedValue(pluginPath);

    let watchCallback: any;
    const closeMock = vi.fn();
    (fs.watch as any).mockImplementation((_p: any, _o: any, cb: any) => {
      watchCallback = cb;
      return { close: closeMock };
    });

    const onReload = vi.fn().mockResolvedValue(undefined);

    await pluginWatcher.watch(pluginId, onReload);

    expect(fs.watch).toHaveBeenCalledWith(
      pluginPath,
      { recursive: true },
      expect.any(Function)
    );

    // Simulate change
    if (watchCallback) {
      watchCallback('change', 'index.js');
      watchCallback('change', 'styles.css');
    }

    // Debounce: should not be called yet
    vi.advanceTimersByTime(100);
    expect(onReload).not.toHaveBeenCalled();

    // Advance past debounce
    vi.advanceTimersByTime(400); // 100 + 400 = 500
    // Small extra tick for the promise inside the callback
    await Promise.resolve();

    expect(onReload).toHaveBeenCalledWith(pluginId);
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('should handle errors when starting watcher', async () => {
    vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
    (fs.watch as any).mockImplementation(() => {
      throw new Error('Watch fail');
    });

    await pluginWatcher.watch('p1', vi.fn());
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to start watcher'),
      'Watch fail'
    );
  });

  it('should stop watcher', async () => {
    vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
    const closeMock = vi.fn();
    (fs.watch as any).mockReturnValue({ close: closeMock });

    await pluginWatcher.watch('p1', vi.fn());
    pluginWatcher.stop('p1');

    expect(closeMock).toHaveBeenCalled();
  });

  it('does not watch a plugin twice', async () => {
    vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
    (fs.watch as any).mockReturnValue({ close: vi.fn() });

    await pluginWatcher.watch('p1', vi.fn());
    await pluginWatcher.watch('p1', vi.fn());

    expect(pluginLoader.getPluginPath).toHaveBeenCalledTimes(1);
    expect(fs.watch).toHaveBeenCalledTimes(1);
  });

  it('does not watch a plugin whose directory is unknown', async () => {
    vi.mocked(pluginLoader.getPluginPath).mockResolvedValue(null);

    await pluginWatcher.watch('p1', vi.fn());

    expect(fs.watch).not.toHaveBeenCalled();
    // Nothing was registered, so stopping finds nothing to close.
    pluginWatcher.stop('p1');
    expect(log.info).not.toHaveBeenCalledWith(
      '[PluginWatcher] Stopped watcher for p1'
    );
  });

  it('cancels a pending reload when the watcher stops', async () => {
    vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
    let watchCallback: any;
    const closeMock = vi.fn();
    (fs.watch as any).mockImplementation((_p: any, _o: any, cb: any) => {
      watchCallback = cb;
      return { close: closeMock };
    });
    const onReload = vi.fn().mockResolvedValue(undefined);
    await pluginWatcher.watch('p1', onReload);

    watchCallback('change', 'index.js');
    pluginWatcher.stop('p1');
    vi.advanceTimersByTime(1_000);
    await Promise.resolve();

    expect(onReload).not.toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('should handle reload errors', async () => {
    vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
    let watchCallback: any;
    (fs.watch as any).mockImplementation((_p: any, _o: any, cb: any) => {
      watchCallback = cb;
      return { close: vi.fn() };
    });

    const onReload = vi.fn().mockRejectedValue(new Error('Reload fail'));
    await pluginWatcher.watch('p1', onReload);

    if (watchCallback) {
      watchCallback('change', 'f.js');
    }
    vi.advanceTimersByTime(500);

    // Wait for async call and the catch block
    await Promise.resolve();
    await Promise.resolve();

    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining('Auto-reload failed'),
      'Reload fail'
    );
  });
});
