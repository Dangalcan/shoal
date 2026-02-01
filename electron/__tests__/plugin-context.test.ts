import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPluginContext } from '../services/plugins/plugin-context';
import fs from 'fs/promises';
import { app } from 'electron';
import child_process from 'child_process';
import path from 'path';

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
// Mock dependency for notification
vi.mock('../main', () => ({
  win: {
    webContents: {
      send: vi.fn(),
    },
  },
}));

describe('Plugin Context', () => {
  const pluginId = 'test-plugin';
  const pluginPath = '/plugins/test-plugin';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(app.getPath).mockReturnValue('/userData');
  });

  describe('Permissions', () => {
    it('should deny access to unrequested permissions', async () => {
      const context = createPluginContext(pluginId, pluginPath, []);

      // Kubernetes and UI throw synchronously because the Proxy intercepts the get immediately returning a throwing function
      expect(() => context.kubernetes.getResources('pods', 'default')).toThrow(
        /Permission denied/
      );
      expect(() => context.ui.showNotification('test', 'info')).toThrow(
        /Permission denied/
      );

      // Storage methods are also proxied the same way, so they throw synchronously too, instead of returning a rejected promise
      expect(() => context.storage.get('key')).toThrow(/Permission denied/);
    });

    it('should grant access to requested permissions', async () => {
      const context = createPluginContext(pluginId, pluginPath, [
        'kubernetes',
        'ui',
        'storage',
      ]);

      // Should not throw
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
        expect.stringContaining('kubectl get pods -n default'),
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
        expect.stringContaining('kubectl apply -f'),
        expect.any(Function)
      );
    });

    it('deleteResource should handle namespace all vs specific', async () => {
      const execMock = vi.mocked(child_process.exec) as unknown as ReturnType<
        typeof vi.fn
      >;
      execMock.mockImplementation((cmd, cb) => cb(null, { stdout: '' }));

      await context.kubernetes.deleteResource('pods', 'my-pod', 'all');
      expect(execMock).toHaveBeenCalledWith(
        expect.stringContaining('kubectl delete pods my-pod'),
        expect.any(Function)
      );
      // Verify it doesn't have -n
      expect(execMock.mock.calls[0][0]).not.toContain('-n');

      await context.kubernetes.deleteResource('pods', 'my-pod', 'default');
      expect(execMock).toHaveBeenCalledWith(
        expect.stringContaining('kubectl delete pods my-pod -n default'),
        expect.any(Function)
      );
    });

    it('should throw error on kubectl failure', async () => {
      const execMock = vi.mocked(child_process.exec) as unknown as ReturnType<
        typeof vi.fn
      >;
      execMock.mockImplementation((cmd, cb) =>
        cb(new Error('kubectl error'), { stdout: '', stderr: 'kubectl error' })
      );

      await expect(
        context.kubernetes.getResources('pods', 'default')
      ).rejects.toThrow('Failed to get resources');
      await expect(
        context.kubernetes.deleteResource('pods', 'n1', 'ns1')
      ).rejects.toThrow('Failed to delete resource');
      await expect(
        context.kubernetes.executeCommand('p1', 'ns1', 'ls')
      ).rejects.toThrow('Failed to execute command');
    });
  });

  describe('Storage API Branches', () => {
    const context = createPluginContext(pluginId, pluginPath, ['storage']);

    it('get should return null on file not found', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      const result = await context.storage.get('test');
      expect(result).toBeNull();
    });

    it('delete should ignore ENOENT but throw others', async () => {
      const enoent = new Error('not found');
      (enoent as any).code = 'ENOENT';
      vi.mocked(fs.unlink).mockRejectedValue(enoent);
      await expect(context.storage.delete('test')).resolves.not.toThrow();

      const other = new Error('locked');
      (other as any).code = 'EBUSY';
      vi.mocked(fs.unlink).mockRejectedValue(other);
      await expect(context.storage.delete('test')).rejects.toThrow(
        'Failed to delete data'
      );
    });

    it('clear should handle empty or populated directory', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['f1.json', 'f2.json'] as any);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      await context.storage.clear();
      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });

    it('clear should throw on readdir failure', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('crash'));
      await expect(context.storage.clear()).rejects.toThrow(
        'Failed to clear storage'
      );
    });
  });

  describe('UI API', () => {
    const context = createPluginContext(pluginId, pluginPath, ['ui']);

    it('registerSidebarItem should add extension', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      context.ui.registerSidebarItem({
        id: 'my-item',
        label: 'My Item',
        route: '/my-route',
      });
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Registered sidebar item'),
        'My Item'
      );
      logSpy.mockRestore();
    });
  });

  describe('Storage API', () => {
    const context = createPluginContext(pluginId, pluginPath, ['storage']);

    it('get should read file', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ foo: 'bar' }));
      const result = await context.storage.get('test');
      expect(result).toEqual({ foo: 'bar' });
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('test.json'),
        'utf-8'
      );
    });

    it('set should write file', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined); // Ensure directory creation is mocked
      await context.storage.set('test', { foo: 'bar' });
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('delete should remove file', async () => {
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      await context.storage.delete('test');
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('Logger API', () => {
    const context = createPluginContext(pluginId, pluginPath, []); // Logger always available

    it('should log to console', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      context.logger.info('test info');
      expect(logSpy).toHaveBeenCalled();

      context.logger.warn('test warn');
      expect(warnSpy).toHaveBeenCalled();

      context.logger.error('test error');
      expect(errorSpy).toHaveBeenCalled();

      context.logger.debug('test debug');
      expect(debugSpy).toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });

  describe('Events API', () => {
    const context = createPluginContext(pluginId, pluginPath, []);

    it('should emit and listen events', () => {
      const spy = vi.fn();
      context.events.on('test-event', spy);
      context.events.emit('test-event', 'payload');
      expect(spy).toHaveBeenCalledWith('payload');

      context.events.off('test-event', spy);
      context.events.emit('test-event', 'again');
      // Depending on implementation, might check if off works.
      // Assuming underlying emitter works.
    });
  });
});
