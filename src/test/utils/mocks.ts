import { vi } from 'vitest';
import type { ElectronAPI } from '../../types.d';

/**
 * Creates a mock Electron API with sensible defaults.
 * All methods return successful responses by default.
 *
 * @param overrides - Partial overrides for specific methods
 * @returns Mock Electron API object
 *
 * @example
 * ```typescript
 * const mockAPI = createMockElectronAPI({
 *   getClusters: vi.fn().mockResolvedValue(['cluster-1', 'cluster-2']),
 *   deleteCluster: vi.fn().mockResolvedValue({ success: false, error: 'Failed' }),
 * });
 *
 * window.electron = mockAPI;
 * ```
 */
export function createMockElectronAPI(
  overrides?: Partial<ElectronAPI>
): ElectronAPI {
  return {
    runCommand: vi
      .fn()
      .mockResolvedValue({ success: true, data: { stdout: '', stderr: '' } }),
    checkTool: vi.fn().mockResolvedValue(true),
    createCluster: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    getClusters: vi.fn().mockResolvedValue({ success: true, data: [] }),
    deleteCluster: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    getCurrentContext: vi
      .fn()
      .mockResolvedValue({ success: true, data: 'None' }),
    switchContext: vi.fn().mockResolvedValue({ success: true, data: true }),
    getPods: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getNamespaces: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getResources: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getLogs: vi.fn().mockResolvedValue({ success: true, data: '' }),
    describeResource: vi.fn().mockResolvedValue({ success: true, data: '' }),
    getResourceYaml: vi.fn().mockResolvedValue({ success: true, data: '' }),
    rolloutRestart: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    deleteResource: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    getAppVersion: vi
      .fn()
      .mockResolvedValue({ success: true, data: '1.0.0-test' }),
    getKubeconfigPath: vi
      .fn()
      .mockResolvedValue({ success: true, data: '/path/to/kubeconfig' }),
    setKubeconfigPath: vi.fn().mockResolvedValue({ success: true, data: true }),
    ...overrides,
  };
}

/**
 * Resets all mocks to their initial state.
 * Call this in beforeEach to ensure test isolation.
 */
export function resetAllMocks() {
  vi.clearAllMocks();
}
