import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../logger', () => ({
  default: {
    error: (...args: unknown[]) => console.error(...args),
    warn: (...args: unknown[]) => console.warn(...args),
    info: (...args: unknown[]) => console.log(...args),
    debug: (...args: unknown[]) => console.debug(...args),
    verbose: (...args: unknown[]) => console.log(...args),
  },
}));

import { createPluginContext } from '../services/plugins/plugin-context';
import {
  getAllPluginExtensions,
  clearPluginExtensions,
} from '../services/plugins/plugin-extensions';
import fs from 'fs/promises';
import { app } from 'electron';
import child_process from 'child_process';

// Mocks
vi.mock('fs/promises', () => {
  const mocks = {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    unlink: vi.fn(),
    readdir: vi.fn(),
  };
  return {
    default: mocks,
    ...mocks,
  };
});

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(),
  },
}));

vi.mock('child_process', () => {
  const mocks = {
    exec: vi.fn(),
    spawn: vi.fn(),
  };
  return {
    ...mocks,
    default: mocks,
  };
});

vi.mock('../services/plugins/path-service', () => ({
  pathService: {
    getPluginStorageDir: vi
      .fn()
      .mockReturnValue('/mock/user/data/plugin-storage'),
  },
}));

// In-memory store that backs the stateful storageService mock
const mockStore = new Map<string, Map<string, any>>();

vi.mock('../services/plugins/storage-service', () => ({
  storageService: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    getAllByKey: vi.fn(),
  },
}));

// Mock win for notification / modal tests.
// plugin-context now reads the window via pluginEventBus.getMainWindow(),
// so we mock the event bus and make getMainWindow return the current mockWin.
let mockWin: any = null;

vi.mock('../services/plugins/plugin-events', () => ({
  pluginEventBus: {
    getMainWindow: vi.fn(() => mockWin),
    setMainWindow: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    emitClusterConnected: vi.fn(),
    emitClusterDisconnected: vi.fn(),
    emitResourceCreated: vi.fn(),
    emitResourceUpdated: vi.fn(),
    emitResourceDeleted: vi.fn(),
    emitPluginActivated: vi.fn(),
    emitPluginDeactivated: vi.fn(),
  },
}));

describe('Plugin Context', () => {
  const pluginId = 'test-plugin';
  const pluginPath = '/plugins/test-plugin';

  beforeEach(async () => {
    // resetAllMocks resets both call history AND any overridden implementations
    // (e.g. mockImplementation(() => { throw }) set in a previous test)
    vi.resetAllMocks();
    mockStore.clear();

    // Re-apply stateful implementations so UI/extension tests work without
    // manual mock setup, and clearPluginExtensions() below doesn't throw
    const { storageService } =
      await import('../services/plugins/storage-service');
    vi.mocked(storageService.get).mockImplementation(
      (pluginId: string, key: string) =>
        mockStore.get(pluginId)?.get(key) ?? null
    );
    vi.mocked(storageService.set).mockImplementation(
      (pluginId: string, key: string, value: any) => {
        if (!mockStore.has(pluginId)) mockStore.set(pluginId, new Map());
        mockStore.get(pluginId)!.set(key, value);
      }
    );
    vi.mocked(storageService.delete).mockImplementation(
      (pluginId: string, key: string) => {
        mockStore.get(pluginId)?.delete(key);
      }
    );
    vi.mocked(storageService.clear).mockImplementation((pluginId: string) => {
      mockStore.delete(pluginId);
    });
    vi.mocked(storageService.getAllByKey).mockImplementation((key: string) => {
      const result = new Map<string, any>();
      for (const [pid, keyMap] of mockStore.entries()) {
        if (keyMap.has(key)) result.set(pid, keyMap.get(key));
      }
      return result;
    });

    vi.mocked(app.getPath).mockReturnValue('/userData');

    // Re-apply Promise return values for fs mocks — vi.resetAllMocks() clears mockResolvedValue
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.unlink).mockResolvedValue(undefined);

    clearPluginExtensions(pluginId);
    mockWin = null;

    // Re-apply dynamic implementation after vi.resetAllMocks() clears it.
    const { pluginEventBus } =
      await import('../services/plugins/plugin-events');
    vi.mocked(pluginEventBus.getMainWindow).mockImplementation(() => mockWin);
  });

  describe('Permissions', () => {
    it('should deny access to unrequested permissions', async () => {
      const context = createPluginContext(pluginId, pluginPath, []);

      expect(() => context.kubernetes.getResources('pods', 'default')).toThrow(
        /Permission denied/
      );
      expect(() => context.ui.showNotification('test', 'info')).toThrow(
        /Permission denied/
      );
      expect(() => context.storage.get('key')).toThrow(/Permission denied/);
    });

    it('should grant access to requested permissions', async () => {
      const context = createPluginContext(pluginId, pluginPath, [
        'kubernetes',
        'ui',
        'storage',
      ]);

      vi.mocked(child_process.exec).mockImplementation(((
        cmd: string,
        cb: any
      ) => cb(null, { stdout: '{}' })) as any);
      await expect(
        context.kubernetes.getResources('pods', 'default')
      ).resolves.not.toThrow();

      vi.mocked(fs.readFile).mockResolvedValue('{}');
      await expect(context.storage.get('key')).resolves.not.toThrow();
    });
  });

  describe('Kubernetes API', () => {
    const context = createPluginContext(pluginId, pluginPath, ['kubernetes']);

    it('getResources should call kubectl get', async () => {
      const execMock = vi.mocked(child_process.exec) as unknown as ReturnType<
        typeof vi.fn
      >;
      execMock.mockImplementation((cmd, cb) =>
        cb(null, { stdout: JSON.stringify({ items: [] }) })
      );

      await context.kubernetes.getResources('pods', 'default');
      expect(execMock).toHaveBeenCalledWith(
        expect.stringContaining('kubectl get pods'),
        expect.any(Function)
      );
    });

    it('createResource should call kubectl apply', async () => {
      const execMock = vi.mocked(child_process.exec) as unknown as ReturnType<
        typeof vi.fn
      >;
      execMock.mockImplementation((cmd, cb) => cb(null, { stdout: '' }));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      await context.kubernetes.createResource({ kind: 'Pod' });
      expect(fs.writeFile).toHaveBeenCalled();
      expect(execMock).toHaveBeenCalledWith(
        expect.stringContaining('kubectl apply'),
        expect.any(Function)
      );
    });

    it('updateResource should call kubectl apply', async () => {
      const execMock = vi.mocked(child_process.exec) as unknown as ReturnType<
        typeof vi.fn
      >;
      execMock.mockImplementation((cmd, cb) => cb(null, { stdout: '' }));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await context.kubernetes.updateResource('pods', 'p1', { kind: 'Pod' });
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('deleteResource should handle namespace', async () => {
      const execMock = vi.mocked(child_process.exec) as unknown as ReturnType<
        typeof vi.fn
      >;
      execMock.mockImplementation((cmd, cb) => cb(null, { stdout: '' }));

      await context.kubernetes.deleteResource('pods', 'p1', 'all');
      await context.kubernetes.deleteResource('pods', 'p1', 'default');
      expect(execMock).toHaveBeenCalledTimes(2);
    });

    it('executeCommand should call kubectl exec', async () => {
      const execMock = vi.mocked(child_process.exec) as unknown as ReturnType<
        typeof vi.fn
      >;
      execMock.mockImplementation((cmd, cb) => cb(null, { stdout: 'output' }));

      const res = await context.kubernetes.executeCommand('p1', 'ns1', 'ls');
      expect(res).toBe('output');
    });

    it('watchResources should spawn kubectl with --watch and handle streaming JSON', async () => {
      let stdoutCallback: any;
      const watchProcessMock = {
        stdout: {
          on: vi.fn((event, cb) => {
            if (event === 'data') stdoutCallback = cb;
          }),
        },
        stderr: { on: vi.fn() },
        kill: vi.fn(),
      };
      vi.mocked(child_process.spawn).mockReturnValue(watchProcessMock as any);

      const events: any[] = [];
      const cleanup = context.kubernetes.watchResources('pods', (e) =>
        events.push(e)
      );

      // Simulate partial JSON chunks
      stdoutCallback(Buffer.from('{"kind":'));
      stdoutCallback(Buffer.from('"Pod", "metadata": {"name": "p1"}}'));

      // Simulate multiple objects in one chunk
      stdoutCallback(
        Buffer.from(
          '{"kind": "Pod", "metadata": {"name": "p2"}}{"kind": "Pod", "metad'
        )
      );
      stdoutCallback(Buffer.from('ata": {"name": "p3"}}'));

      expect(events).toHaveLength(3);
      expect(events[0].metadata.name).toBe('p1');
      expect(events[1].metadata.name).toBe('p2');
      expect(events[2].metadata.name).toBe('p3');

      cleanup();
      expect(watchProcessMock.kill).toHaveBeenCalled();
    });

    it('watchResources should handle JSON parse errors and stderr', () => {
      let stdoutCallback: any;
      let stderrCallback: any;
      const watchProcessMock = {
        stdout: {
          on: vi.fn((event, cb) => {
            if (event === 'data') stdoutCallback = cb;
          }),
        },
        stderr: {
          on: vi.fn((event, cb) => {
            if (event === 'data') stderrCallback = cb;
          }),
        },
        kill: vi.fn(),
      };
      vi.mocked(child_process.spawn).mockReturnValue(watchProcessMock as any);
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      context.kubernetes.watchResources('pods', () => {});

      // Invalid JSON
      stdoutCallback(Buffer.from('{invalid}'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse watch event'),
        expect.any(Error)
      );

      // Stderr data
      stderrCallback(Buffer.from('error from kubectl'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Watch error'),
        'error from kubectl'
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle errors in all kubernetes methods', async () => {
      (vi.mocked(child_process.exec) as any).mockImplementation(
        (cmd: any, cb: any) =>
          cb(new Error('fail'), { stdout: '', stderr: 'fail' })
      );

      await expect(context.kubernetes.getResources('p', 'n')).rejects.toThrow(
        'Failed to get resources'
      );
      await expect(context.kubernetes.createResource({})).rejects.toThrow(
        'Failed to create resource'
      );
      await expect(
        context.kubernetes.updateResource('p', 'n', {})
      ).rejects.toThrow('Failed to update resource');
      await expect(
        context.kubernetes.deleteResource('p', 'n', 'ns')
      ).rejects.toThrow('Failed to delete resource');
      await expect(
        context.kubernetes.executeCommand('p', 'ns', 'cmd')
      ).rejects.toThrow('Failed to execute command');
    });
  });

  describe('UI API', () => {
    const context = createPluginContext(pluginId, pluginPath, ['ui']);

    it('registerSidebarItem should add and update extension', () => {
      const item = { id: 's1', label: 'L1', route: '/r1' };
      context.ui.registerSidebarItem(item);
      let ext = getAllPluginExtensions().get(pluginId);
      expect(ext!.sidebar).toHaveLength(1);

      context.ui.registerSidebarItem({ ...item, label: 'L2' });
      ext = getAllPluginExtensions().get(pluginId);
      expect(ext!.sidebar![0].label).toBe('L2');
    });

    it('registerPage should add and update page extension', () => {
      // component must be a string (renderer module path or export name)
      context.ui.registerPage('/p1', './pages/PageC1');
      let ext = getAllPluginExtensions().get(pluginId);
      expect(ext!.pages).toHaveLength(1);

      context.ui.registerPage('/p1', './pages/PageC2'); // Update existing
      ext = getAllPluginExtensions().get(pluginId);
      expect(ext!.pages).toHaveLength(1);
      expect(ext!.pages![0].component).toBe('./pages/PageC2');
    });

    it('registerPage should throw when a non-string component is passed', () => {
      expect(() => context.ui.registerPage('/p1', () => 'MyComponent')).toThrow(
        /must be a string/
      );
    });

    it('registerResourceAction should add and update extension', () => {
      const action = { id: 'a1', label: 'L1', resourceTypes: ['Pod'] };
      context.ui.registerResourceAction('Pod', action);
      let ext = getAllPluginExtensions().get(pluginId);
      expect(ext!.resourceActions).toHaveLength(1);

      context.ui.registerResourceAction('Pod', {
        id: 'a1',
        label: 'L2',
        resourceTypes: ['Pod'],
      });
      ext = getAllPluginExtensions().get(pluginId);
      expect(ext!.resourceActions).toHaveLength(1);
      expect(ext!.resourceActions![0].label).toBe('L2');
    });

    it('showNotification should send IPC message when win is present', () => {
      const sendMock = vi.fn();
      mockWin = { webContents: { send: sendMock } };

      context.ui.showNotification('Hello', 'success');
      expect(sendMock).toHaveBeenCalledWith(
        'plugin-notification',
        expect.objectContaining({
          pluginId,
          message: 'Hello',
          type: 'success',
        })
      );
    });

    it('showNotification should handle null win', () => {
      mockWin = null;
      context.ui.showNotification('Hello', 'info');
    });

    it('openModal should send IPC message', () => {
      const sendMock = vi.fn();
      mockWin = { webContents: { send: sendMock } };

      context.ui.openModal('MyComp', { id: 1 });
      expect(sendMock).toHaveBeenCalledWith(
        'plugin-modal',
        expect.objectContaining({
          component: 'MyComp',
          props: { id: 1 },
          pluginId,
        })
      );
    });
  });

  describe('Storage API', () => {
    const context = createPluginContext(pluginId, pluginPath, ['storage']);

    it('get should call storageService', async () => {
      const { storageService } =
        await import('../services/plugins/storage-service');
      vi.mocked(storageService.get).mockReturnValue({ a: 1 });
      const res = await context.storage.get('k');
      expect(res).toEqual({ a: 1 });
      expect(storageService.get).toHaveBeenCalledWith(pluginId, 'k');
    });

    it('set should call storageService', async () => {
      const { storageService } =
        await import('../services/plugins/storage-service');
      await context.storage.set('k', { a: 1 });
      expect(storageService.set).toHaveBeenCalledWith(pluginId, 'k', { a: 1 });
    });

    it('set should throw on error', async () => {
      const { storageService } =
        await import('../services/plugins/storage-service');
      vi.mocked(storageService.set).mockImplementation(() => {
        throw new Error('fail');
      });
      await expect(context.storage.set('k', {})).rejects.toThrow(
        'Failed to save data'
      );

      // Branch for non-Error object
      vi.mocked(storageService.set).mockImplementation(() => {
        throw 'string error';
      });
      await expect(context.storage.set('k', {})).rejects.toThrow(
        'Failed to save data: string error'
      );
    });

    it('delete should call storageService', async () => {
      const { storageService } =
        await import('../services/plugins/storage-service');
      await context.storage.delete('k');
      expect(storageService.delete).toHaveBeenCalledWith(pluginId, 'k');
    });

    it('delete should throw on error', async () => {
      const { storageService } =
        await import('../services/plugins/storage-service');
      vi.mocked(storageService.delete).mockImplementation(() => {
        throw new Error('fail');
      });
      await expect(context.storage.delete('k')).rejects.toThrow(
        'Failed to delete data'
      );
    });

    it('clear should call storageService', async () => {
      const { storageService } =
        await import('../services/plugins/storage-service');
      await context.storage.clear();
      expect(storageService.clear).toHaveBeenCalledWith(pluginId);
    });

    it('clear should throw on error', async () => {
      const { storageService } =
        await import('../services/plugins/storage-service');
      vi.mocked(storageService.clear).mockImplementation(() => {
        throw new Error('fail');
      });
      await expect(context.storage.clear()).rejects.toThrow(
        'Failed to clear storage'
      );
    });
  });

  describe('Logger API', () => {
    const context = createPluginContext(pluginId, pluginPath, []);

    it('should log all levels', () => {
      const spies = [
        vi.spyOn(console, 'log').mockImplementation(() => {}),
        vi.spyOn(console, 'warn').mockImplementation(() => {}),
        vi.spyOn(console, 'error').mockImplementation(() => {}),
        vi.spyOn(console, 'debug').mockImplementation(() => {}),
      ];

      context.logger.info('i', 1);
      context.logger.warn('w', 2);
      context.logger.error('e', 3);
      context.logger.debug('d', 4);

      spies.forEach((s) => expect(s).toHaveBeenCalled());
      spies.forEach((s) => s.mockRestore());
    });
  });

  describe('Events API', () => {
    const context = createPluginContext(pluginId, pluginPath, []);

    it('should handle standard events', () => {
      const spy = vi.fn();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      context.events.on('e', spy);
      context.events.emit('e', 1);
      expect(spy).toHaveBeenCalledWith(1);

      context.events.off('e', spy);
      context.events.emit('e', 2);
      expect(spy).toHaveBeenCalledTimes(1);

      context.events.once('once', spy);
      context.events.emit('once', 3);
      context.events.emit('once', 4);
      expect(spy).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });

    it('should handle app hooks', async () => {
      const { pluginEventBus } =
        await import('../services/plugins/plugin-events');
      const emitSpy = vi.spyOn(pluginEventBus, 'on');
      const handler = () => {};

      context.events.onClusterConnected(handler);
      expect(emitSpy).toHaveBeenCalledWith('cluster:connected', handler);

      context.events.onClusterDisconnected(handler);
      expect(emitSpy).toHaveBeenCalledWith('cluster:disconnected', handler);

      context.events.onResourceCreated(handler);
      expect(emitSpy).toHaveBeenCalledWith('resource:created', handler);

      context.events.onResourceUpdated(handler);
      expect(emitSpy).toHaveBeenCalledWith('resource:updated', handler);

      context.events.onResourceDeleted(handler);
      expect(emitSpy).toHaveBeenCalledWith('resource:deleted', handler);
    });

    it('should handle cross-plugin broadcast events', async () => {
      const { pluginEventBus } =
        await import('../services/plugins/plugin-events');
      const emitSpy = vi.spyOn(pluginEventBus, 'emit');
      const onSpy = vi.spyOn(pluginEventBus, 'on');
      const offSpy = vi.spyOn(pluginEventBus, 'off');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const handler = () => {};

      context.events.broadcast('custom-event', { data: 123 });
      expect(emitSpy).toHaveBeenCalledWith('plugin-broadcast:custom-event', {
        sender: pluginId,
        payload: [{ data: 123 }],
      });

      context.events.onBroadcast('custom-event', handler);
      expect(onSpy).toHaveBeenCalledWith(
        'plugin-broadcast:custom-event',
        handler
      );

      context.events.offBroadcast('custom-event', handler);
      expect(offSpy).toHaveBeenCalledWith(
        'plugin-broadcast:custom-event',
        handler
      );

      emitSpy.mockRestore();
      onSpy.mockRestore();
      offSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('Extension Registry Helpers', () => {
    it('should manage global extensions', () => {
      const context = createPluginContext(pluginId, pluginPath, ['ui']);
      context.ui.registerSidebarItem({ id: 's1', label: 'L', route: '/r' });

      expect(getAllPluginExtensions().has(pluginId)).toBe(true);
      clearPluginExtensions(pluginId);
      expect(getAllPluginExtensions().has(pluginId)).toBe(false);
    });
  });

  describe('createDeniedAPI', () => {
    it('should throw error when any property is accessed', () => {
      const context = createPluginContext(pluginId, pluginPath, []);
      expect(() => (context.kubernetes as any).anyMethod()).toThrow(
        /Permission denied: Plugin does not have 'kubernetes' permission/
      );
    });
  });
});
