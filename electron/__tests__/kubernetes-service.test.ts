import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KubernetesService } from '../services/kubernetes/kubernetes-service';
import { pluginEventBus } from '../services/plugins/plugin-events';
import fs from 'fs/promises';
import { app } from 'electron';

// Mock dependencies
vi.mock('child_process', () => {
  const mockExec = vi.fn();
  return {
    exec: mockExec,
    default: {
      exec: mockExec,
    },
  };
});

vi.mock('fs/promises', () => ({
  default: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/temp'),
  },
}));

vi.mock('../services/plugins/plugin-events', () => ({
  pluginEventBus: {
    emitResourceCreated: vi.fn(),
    emitResourceUpdated: vi.fn(),
    emitResourceDeleted: vi.fn(),
  },
}));

import { exec } from 'child_process';

describe('KubernetesService', () => {
  let service: KubernetesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new KubernetesService();
  });

  describe('getResources', () => {
    it('should fetch resources using kubectl', async () => {
      const mockItems = [{ metadata: { name: 'pod-1' } }];
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(null, { stdout: JSON.stringify({ items: mockItems }) });
      }) as any);

      const items = await service.getResources('pods', 'default');
      expect(items).toEqual(mockItems);
      expect(exec).toHaveBeenCalledWith(
        expect.stringMatching(/kubectl get pods.*-n default -o json/),
        expect.any(Function)
      );
    });

    it('should handle namespace all', async () => {
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(null, { stdout: JSON.stringify({ items: [] }) });
      }) as any);

      await service.getResources('pods', 'all');
      expect(exec).toHaveBeenCalledWith(
        expect.stringMatching(/kubectl get pods.*-A -o json/),
        expect.any(Function)
      );
    });

    it('should throw on error', async () => {
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(new Error('K8S Error'), { stdout: '', stderr: 'error' });
      }) as any);

      await expect(service.getResources('pods', 'default')).rejects.toThrow(
        'K8S Error'
      );
    });
  });

  describe('createResource', () => {
    it('should create resource from manifest', async () => {
      const manifest = { kind: 'Pod', metadata: { name: 'p1' } };
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(null, { stdout: 'created' });
      }) as any);

      await service.createResource(manifest);
      expect(fs.writeFile).toHaveBeenCalled();
      expect(exec).toHaveBeenCalledWith(
        expect.stringMatching(/kubectl apply.*-f/),
        expect.any(Function)
      );
      expect(pluginEventBus.emitResourceCreated).toHaveBeenCalledWith(manifest);
    });
  });

  describe('updateResource', () => {
    it('should update resource from manifest', async () => {
      const manifest = { kind: 'Pod', metadata: { name: 'p1' } };
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(null, { stdout: 'updated' });
      }) as any);

      await service.updateResource('pods', 'p1', manifest);
      expect(fs.writeFile).toHaveBeenCalled();
      expect(exec).toHaveBeenCalledWith(
        expect.stringMatching(/kubectl apply.*-f/),
        expect.any(Function)
      );
      expect(pluginEventBus.emitResourceUpdated).toHaveBeenCalledWith(manifest);
    });
  });

  describe('deleteResource', () => {
    it('should delete resource', async () => {
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(null, { stdout: 'deleted' });
      }) as any);

      await service.deleteResource('pods', 'p1', 'default');
      expect(exec).toHaveBeenCalledWith(
        expect.stringMatching(/kubectl delete pods p1.*-n default/),
        expect.any(Function)
      );
      expect(pluginEventBus.emitResourceDeleted).toHaveBeenCalled();
    });
  });

  describe('executeCommand', () => {
    it('should execute command in pod', async () => {
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(null, { stdout: 'output' });
      }) as any);

      const result = await service.executeCommand('p1', 'default', 'ls');
      expect(result).toBe('output');
      expect(exec).toHaveBeenCalledWith(
        expect.stringMatching(/kubectl exec p1.*-n default -- ls/),
        expect.any(Function)
      );
    });

    it('should include context flag when contextName is supplied', async () => {
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(null, { stdout: 'output' });
      }) as any);

      await service.executeCommand('p1', 'default', 'ls', 'my-context');
      expect(exec).toHaveBeenCalledWith(
        expect.stringMatching(/--context my-context/),
        expect.any(Function)
      );
    });

    it('should throw on exec error', async () => {
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(new Error('exec failed'), { stdout: '', stderr: 'error' });
      }) as any);

      await expect(
        service.executeCommand('p1', 'default', 'ls')
      ).rejects.toThrow('exec failed');
    });
  });

  describe('getResources with context', () => {
    it('should include context flag when contextName is supplied', async () => {
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(null, { stdout: JSON.stringify({ items: [] }) });
      }) as any);

      await service.getResources('pods', 'default', 'staging-context');
      expect(exec).toHaveBeenCalledWith(
        expect.stringMatching(/--context staging-context/),
        expect.any(Function)
      );
    });

    it('should return empty array when items is missing from response', async () => {
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(null, { stdout: JSON.stringify({}) });
      }) as any);

      const result = await service.getResources('pods', 'default');
      expect(result).toEqual([]);
    });
  });

  describe('createResource error handling', () => {
    it('should clean up temp file even when kubectl fails', async () => {
      const manifest = { kind: 'Pod', metadata: { name: 'p1' } };
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(new Error('apply failed'), { stdout: '', stderr: 'error' });
      }) as any);

      await expect(service.createResource(manifest)).rejects.toThrow(
        'apply failed'
      );
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should include context flag in createResource', async () => {
      const manifest = { kind: 'Pod', metadata: { name: 'p1' } };
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(null, { stdout: 'created' });
      }) as any);

      await service.createResource(manifest, 'prod-context');
      expect(exec).toHaveBeenCalledWith(
        expect.stringMatching(/--context prod-context/),
        expect.any(Function)
      );
    });
  });

  describe('updateResource error handling', () => {
    it('should clean up temp file even when kubectl fails', async () => {
      const manifest = { kind: 'Pod', metadata: { name: 'p1' } };
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(new Error('update failed'), { stdout: '', stderr: 'error' });
      }) as any);

      await expect(
        service.updateResource('pods', 'p1', manifest)
      ).rejects.toThrow('update failed');
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should include context flag in updateResource', async () => {
      const manifest = { kind: 'Pod', metadata: { name: 'p1' } };
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(null, { stdout: 'updated' });
      }) as any);

      await service.updateResource('pods', 'p1', manifest, 'dev-context');
      expect(exec).toHaveBeenCalledWith(
        expect.stringMatching(/--context dev-context/),
        expect.any(Function)
      );
    });
  });

  describe('deleteResource edge cases', () => {
    it('should omit namespace flag when namespace is empty string', async () => {
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(null, { stdout: 'deleted' });
      }) as any);

      await service.deleteResource('pods', 'p1', '');
      // No -n flag expected
      expect(exec).toHaveBeenCalledWith(
        expect.not.stringMatching(/-n /),
        expect.any(Function)
      );
    });

    it('should omit namespace flag when namespace is "all"', async () => {
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(null, { stdout: 'deleted' });
      }) as any);

      await service.deleteResource('pods', 'p1', 'all');
      expect(exec).toHaveBeenCalledWith(
        expect.not.stringMatching(/-n all/),
        expect.any(Function)
      );
    });

    it('should include context flag in deleteResource', async () => {
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(null, { stdout: 'deleted' });
      }) as any);

      await service.deleteResource('pods', 'p1', 'default', 'prod-context');
      expect(exec).toHaveBeenCalledWith(
        expect.stringMatching(/--context prod-context/),
        expect.any(Function)
      );
    });

    it('should throw on delete error', async () => {
      vi.mocked(exec).mockImplementation(((cmd: string, cb: any) => {
        cb(new Error('delete failed'), { stdout: '', stderr: 'error' });
      }) as any);

      await expect(
        service.deleteResource('pods', 'p1', 'default')
      ).rejects.toThrow('delete failed');
    });
  });
});
