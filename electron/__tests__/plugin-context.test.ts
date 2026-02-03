import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPluginContext,
  getAllPluginExtensions,
  clearPluginExtensions,
} from '../services/plugins/plugin-context';
import fs from 'fs/promises';
import { app } from 'electron';
import child_process from 'child_process';
import Module from 'module';

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
  return {
    default: {
      exec: vi.fn(),
    },
    exec: vi.fn(),
  };
});

// Mock win for notification test
let mockWin: any = null;

// Mock Module.prototype.require to handle the dynamic require('../../main') in plugin-context.ts
const originalRequire = Module.prototype.require;
// @ts-ignore
Module.prototype.require = function (id: string) {
  if (
    id === '../../main' ||
    id === '../main' ||
    id.endsWith('main') ||
    id.endsWith('main.ts')
  ) {
    return { win: mockWin };
  }
  return originalRequire.apply(this, arguments as any);
};

describe('Plugin Context', () => {
  const pluginId = 'test-plugin';
  const pluginPath = '/plugins/test-plugin';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(app.getPath).mockReturnValue('/userData');
    clearPluginExtensions(pluginId);
    mockWin = null;
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

    it('watchResources should return a cleanup function', () => {
      const cleanup = context.kubernetes.watchResources('pods', () => {});
      expect(typeof cleanup).toBe('function');
      cleanup();
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
      expect(ext.sidebar).toHaveLength(1);

      context.ui.registerSidebarItem({ ...item, label: 'L2' });
      ext = getAllPluginExtensions().get(pluginId);
      expect(ext.sidebar[0].label).toBe('L2');
    });

    it('registerPage should add and update page extension', () => {
      context.ui.registerPage('/p1', () => 'C1');
      let ext = getAllPluginExtensions().get(pluginId);
      expect(ext.pages).toHaveLength(1);

      context.ui.registerPage('/p2', () => 'C2');
      ext = getAllPluginExtensions().get(pluginId);
      expect(ext.pages[0].route).toBe('/p2');
    });

    it('registerResourceAction should add and update extension', () => {
      const action = { id: 'a1', label: 'L1', resourceTypes: ['Pod'] };
      context.ui.registerResourceAction('Pod', action);
      let ext = getAllPluginExtensions().get(pluginId);
      expect(ext.resourceActions).toHaveLength(1);

      context.ui.registerResourceAction('Pod', { ...action, label: 'L2' });
      ext = getAllPluginExtensions().get(pluginId);
      expect(ext.resourceActions[0].label).toBe('L2');
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

    it('openModal should be callable', () => {
      context.ui.openModal('Comp');
    });
  });

  describe('Storage API', () => {
    const context = createPluginContext(pluginId, pluginPath, ['storage']);

    it('get should read and parse file', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{"a":1}');
      const res = await context.storage.get('k');
      expect(res).toEqual({ a: 1 });
    });

    it('get should return null on error', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      const res = await context.storage.get('k');
      expect(res).toBeNull();
    });

    it('set should write file', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      await context.storage.set('k', { a: 1 });
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('set should throw on error', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('fail'));
      await expect(context.storage.set('k', {})).rejects.toThrow(
        'Failed to save data'
      );
    });

    it('delete should remove file', async () => {
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      await context.storage.delete('k');
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('delete should ignore ENOENT', async () => {
      const err = new Error('not found');
      (err as any).code = 'ENOENT';
      vi.mocked(fs.unlink).mockRejectedValue(err);
      await expect(context.storage.delete('k')).resolves.not.toThrow();
    });

    it('delete should throw other errors', async () => {
      vi.mocked(fs.unlink).mockRejectedValue(new Error('fail'));
      await expect(context.storage.delete('k')).rejects.toThrow(
        'Failed to delete data'
      );
    });

    it('clear should remove all files', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['f1'] as any);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      await context.storage.clear();
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('clear should throw on error', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('fail'));
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

      context.logger.info('i');
      context.logger.warn('w');
      context.logger.error('e');
      context.logger.debug('d');

      spies.forEach((s) => expect(s).toHaveBeenCalled());
      spies.forEach((s) => s.mockRestore());
    });
  });

  describe('Events API', () => {
    const context = createPluginContext(pluginId, pluginPath, []);

    it('should handle standard events', () => {
      const spy = vi.fn();
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
    });

    it('should handle app hooks', () => {
      const handler = () => {};
      context.events.onClusterConnected(handler);
      context.events.onClusterDisconnected(handler);
      context.events.onResourceCreated(handler);
      context.events.onResourceUpdated(handler);
      context.events.onResourceDeleted(handler);
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
});
