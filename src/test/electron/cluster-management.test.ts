// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClusterManagementService } from '../../../electron/cluster-management-service';
import * as child_process from 'child_process';

// Improved mock to avoid "No default export" error
vi.mock('child_process', () => {
  return {
    exec: vi.fn(),
  };
});

describe('ClusterManagementService Tests', () => {
  let service: ClusterManagementService;
  const mockExec = vi.mocked(child_process.exec);

  beforeEach(() => {
    service = new ClusterManagementService();
    vi.clearAllMocks();
  });

  describe('deleteCluster', () => {
    it('should delete a kind cluster and remove its context', async () => {
      const contextName = 'kind-test-cluster';
      let callCount = 0;

      mockExec.mockImplementation((cmd: string, callback: any) => {
        callCount++;
        if (cmd === 'kind delete cluster --name test-cluster') {
          callback(null, { stdout: 'Deleted' });
        } else if (cmd === 'kubectl config get-contexts -o name') {
          if (callCount <= 2) {
            callback(null, { stdout: 'kind-test-cluster\nother-context' });
          } else {
            callback(null, { stdout: 'other-context' });
          }
        } else if (cmd === 'kubectl config delete-context kind-test-cluster') {
          callback(null, { stdout: 'deleted' });
        }
        return {} as any;
      });

      const result = await service.deleteCluster(contextName);

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('kind delete cluster'),
        expect.any(Function)
      );
    });

    it('should return failure if context still exists after all attempts', async () => {
      const contextName = 'stubborn-cluster';

      mockExec.mockImplementation((cmd: string, callback: any) => {
        if (cmd === 'kubectl config get-contexts -o name') {
          callback(null, { stdout: 'stubborn-cluster' });
        } else if (cmd === 'kubectl config delete-context stubborn-cluster') {
          callback(null, { stdout: 'Attempted delete' });
        }
        return {} as any;
      });

      const result = await service.deleteCluster(contextName);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to remove context');
    });
  });
});
