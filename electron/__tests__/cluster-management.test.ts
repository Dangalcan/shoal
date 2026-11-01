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

describe('ClusterManagementService Tests', () => {
  let service: ClusterManagementService;

  beforeEach(() => {
    service = new ClusterManagementService();
    vi.clearAllMocks();
  });

  describe('deleteCluster', () => {
    it('should delete a kind cluster and remove its context', async () => {
      const contextName = 'kind-test-cluster';
      let getContextsCalls = 0;

      mockSafeExec.mockImplementation(async (tool, args) => {
        const cmd = `${tool} ${(args as string[]).join(' ')}`;
        if (cmd === 'kubectl config get-contexts -o name') {
          getContextsCalls++;
          return getContextsCalls === 1
            ? { stdout: 'kind-test-cluster\nother-context', stderr: '' }
            : { stdout: 'other-context', stderr: '' };
        }
        return { stdout: '', stderr: '' };
      });

      const result = await service.deleteCluster(contextName);

      expect(result.success).toBe(true);
      expect(mockSafeExec).toHaveBeenCalledWith('kind', [
        'delete',
        'cluster',
        '--name',
        'test-cluster',
      ]);
    });

    it('should return failure if context still exists after all attempts', async () => {
      const contextName = 'stubborn-cluster';

      mockSafeExec.mockImplementation(async (tool, args) => {
        const cmd = `${tool} ${(args as string[]).join(' ')}`;
        if (cmd === 'kubectl config get-contexts -o name') {
          return { stdout: 'stubborn-cluster', stderr: '' };
        }
        return { stdout: '', stderr: '' };
      });

      const result = await service.deleteCluster(contextName);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to remove context');
    });
  });
});
