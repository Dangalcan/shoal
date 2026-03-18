import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClusterManagementService } from '../services/cluster/cluster-management-service';
import * as child_process from 'child_process';

const mocks = vi.hoisted(() => ({
  exec: vi.fn(),
}));

vi.mock('child_process', () => {
  const m = {
    exec: mocks.exec,
  };
  return {
    ...m,
    default: m,
  };
});

// Mock util.promisify to return our mocked exec directly,
// since we can't easily mock the result of util.promisify(child_process.exec)
// without digging into implementation details.
// Instead, we can rely on how the service implementation might change to dependencies injection,
// OR more simply, we can mock the module that exports the promisified version if it was separate.
// But here `execPromise` is created INSIDE the module user `util.promisify(child_process.exec)`.
// `util.promisify` returns a function that calls the original function.
// So mocking `child_process.exec` should work if `util.promisify` wraps the *reference*
// or if we intercept it before the service imports it.
//
// However, since `execPromise` is defined at top-level constant time in the module:
// `const execPromise = util.promisify(child_process.exec);`
// We need to ensure our mock is in place BEFORE that line runs.
// Vitest `vi.mock` is hoisted, so it should work.

describe('ClusterManagementService', () => {
  let service: ClusterManagementService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ClusterManagementService();
    // Default success for exec
    mocks.exec.mockImplementation((cmd, cb) => {
      cb(null, { stdout: '', stderr: '' });
    });
  });

  describe('createCluster', () => {
    it('should create a kind cluster successfully', async () => {
      const result = await service.createCluster('test-cluster', 'kind');

      expect(mocks.exec).toHaveBeenCalledWith(
        expect.stringContaining('kind create cluster --name test-cluster'),
        expect.any(Function)
      );
      expect(result).toEqual({ success: true });
    });

    it('should create a k3d cluster successfully', async () => {
      const result = await service.createCluster('test-cluster', 'k3d');

      expect(mocks.exec).toHaveBeenCalledWith(
        expect.stringContaining('k3d cluster create test-cluster'),
        expect.any(Function)
      );
      expect(result).toEqual({ success: true });
    });

    it('should handle creation errors', async () => {
      mocks.exec.mockImplementation((cmd, cb) => {
        cb(new Error('Creation failed'), null);
      });

      const result = await service.createCluster('test-cluster', 'kind');

      expect(result).toEqual({ success: false, error: 'Creation failed' });
    });
  });

  describe('deleteCluster', () => {
    it('should delete a kind cluster and verify context removal', async () => {
      // Mock sequence:
      // 1. Delete command (success)
      // 2. Check context (found)
      // 3. Delete context (success)
      // 4. Final verification (not found)

      mocks.exec.mockImplementation((cmd, cb) => {
        if (cmd.includes('delete cluster')) {
          cb(null, { stdout: '' });
        } else if (cmd === 'kubectl config get-contexts -o name') {
          // First check returns list including context, second check (verification) returns empty or list without it
          // implementation calls it twice.
          // We can check how many times it was called to return different values?
          // checking calls:
          // 1. delete cluster
          // 2. get-contexts (to see if we need to explicit delete)
          // 3. delete-context
          // 4. get-contexts (verification)
          cb(null, { stdout: 'kind-test-cluster\nother-context' });
        } else if (cmd.includes('delete-context')) {
          cb(null, { stdout: '' });
        } else {
          cb(null, { stdout: '' });
        }
      });

      // We need to be careful with the mock implementation for the 4th call (verification)
      // If we return the context exists, it returns failure.
      // So we need stateful mock.
      let getContextsCallCount = 0;
      mocks.exec.mockImplementation((cmd, cb) => {
        if (cmd.includes('kind delete cluster')) {
          cb(null, { stdout: '' });
        } else if (cmd === 'kubectl config get-contexts -o name') {
          getContextsCallCount++;
          if (getContextsCallCount === 1) {
            // First check: context exists
            cb(null, { stdout: 'kind-test-cluster\nother-context' });
          } else {
            // Verification: context gone
            cb(null, { stdout: 'other-context' });
          }
        } else if (cmd.includes('delete-context')) {
          cb(null, { stdout: '' });
        } else {
          cb(null, { stdout: '' });
        }
      });

      const result = await service.deleteCluster('kind-test-cluster');

      expect(mocks.exec).toHaveBeenCalledWith(
        expect.stringContaining('kind delete cluster --name test-cluster'),
        expect.any(Function)
      );
      expect(mocks.exec).toHaveBeenCalledWith(
        expect.stringContaining(
          'kubectl config delete-context kind-test-cluster'
        ),
        expect.any(Function)
      );
      expect(result).toEqual({ success: true });
    });

    it('should handle deletion errors and return failure', async () => {
      mocks.exec.mockImplementation((cmd, cb) => {
        if (cmd.includes('kind delete cluster')) {
          cb(new Error('Cluster not found'), null);
        }
      });

      const result = await service.deleteCluster('kind-test-cluster');

      // Should have tried to delete cluster
      expect(mocks.exec).toHaveBeenCalledWith(
        expect.stringContaining('kind delete cluster'),
        expect.any(Function)
      );
      // And returned failure
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cluster not found');
    });

    it('should handle context check errors without failing the whole process', async () => {
      let contextCalls = 0;
      mocks.exec.mockImplementation((cmd, cb) => {
        if (cmd.includes('kind delete cluster')) {
          cb(null, { stdout: '' });
        } else if (cmd.includes('config get-contexts')) {
          contextCalls++;
          if (contextCalls === 1) {
            cb(new Error('Kubeconfig error'), null);
          } else {
            cb(null, { stdout: '' }); // allow final verification to succeed
          }
        } else {
          cb(null, { stdout: '' });
        }
      });

      const result = await service.deleteCluster('kind-test-cluster');

      // Should still return success if the main deletion succeeded
      expect(result.success).toBe(true);
    });

    it('should delete a k3d cluster', async () => {
      mocks.exec.mockImplementation((cmd, cb) => {
        cb(null, { stdout: '' });
      });

      const result = await service.deleteCluster('k3d-test');

      expect(mocks.exec).toHaveBeenCalledWith(
        expect.stringContaining('k3d cluster delete test'),
        expect.any(Function)
      );
      expect(result.success).toBe(true);
    });

    it('should handle non-kind/k3d contexts', async () => {
      mocks.exec.mockImplementation((cmd, cb) => {
        cb(null, { stdout: '' });
      });

      const result = await service.deleteCluster('some-other-context');

      // Should not have called kind or k3d delete
      expect(mocks.exec).not.toHaveBeenCalledWith(
        expect.stringContaining('kind delete'),
        expect.any(Function)
      );
      expect(mocks.exec).not.toHaveBeenCalledWith(
        expect.stringContaining('k3d cluster delete'),
        expect.any(Function)
      );
      // But should have checked context
      expect(mocks.exec).toHaveBeenCalledWith(
        expect.stringContaining('kubectl config get-contexts'),
        expect.any(Function)
      );
      expect(result.success).toBe(true);
    });
  });
});
