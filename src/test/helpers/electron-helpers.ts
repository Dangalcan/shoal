/**
 * Electron API Test Helpers
 *
 * Helper functions for setting up and managing Electron API mocks in tests.
 * These helpers reduce duplication and provide consistent mock behavior.
 */

import { vi } from 'vitest';
import { mockElectronAPI } from '../setup';

/**
 * Configure mock cluster state
 *
 * @param clusters - Array of cluster names
 * @param currentContext - Currently active context (or 'None')
 *
 * @example
 * ```typescript
 * mockClusterState(['cluster-1', 'cluster-2'], 'cluster-1')
 * ```
 */
export const mockClusterState = (
  clusters: string[],
  currentContext: string = 'None',
  mockApi: any
) => {
  mockApi.getClusters = vi.fn().mockResolvedValue({
    success: true,
    data: clusters,
  });
  mockApi.getCurrentContext = vi.fn().mockResolvedValue({
    success: true,
    data: currentContext,
  });
};

/**
 * Configure mock tool status (Docker, Podman, etc.)
 *
 * @param tools - Object mapping tool names to availability status
 *
 * @example
 * ```typescript
 * mockToolStatus({ docker: true, podman: false })
 * ```
 */
export const mockToolStatus = (
  tools: Record<string, boolean>,
  mockApi: any
) => {
  mockApi.checkTool = vi.fn().mockImplementation(async (tool: string) => {
    return { success: true, data: tools[tool] ?? false };
  });
};

/**
 * Configure mock Kubernetes resource response
 *
 * @param resourceType - Type of resource (pods, deployments, etc.)
 * @param items - Array of resource items
 * @param success - Whether the operation succeeded
 *
 * @example
 * ```typescript
 * mockResourceResponse('pods', mockPods, true)
 * ```
 */
export const mockResourceResponse = <T>(
  resourceType: 'pods' | 'namespaces' | 'resources',
  items: T[],
  success: boolean = true
) => {
  switch (resourceType) {
    case 'pods':
      mockElectronAPI.getPods.mockResolvedValue({ success, data: items });
      break;
    case 'namespaces':
      mockElectronAPI.getNamespaces.mockResolvedValue({
        success,
        data: items,
      });
      break;
    case 'resources':
      mockElectronAPI.getResources.mockResolvedValue({ success, data: items });
      break;
  }
};

/**
 * Reset all Electron API mocks to their default successful state
 *
 * Call this in beforeEach to ensure clean state between tests.
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   resetElectronMocks()
 * })
 * ```
 */
export const resetElectronMocks = () => {
  mockElectronAPI.checkTool.mockResolvedValue(true);
  mockElectronAPI.createCluster.mockResolvedValue({
    success: true,
    data: undefined,
  });
  mockElectronAPI.getClusters.mockResolvedValue({ success: true, data: [] });
  mockElectronAPI.deleteCluster.mockResolvedValue({
    success: true,
    data: undefined,
  });
  mockElectronAPI.getCurrentContext.mockResolvedValue({
    success: true,
    data: 'None',
  });
  mockElectronAPI.getPods.mockResolvedValue({ success: true, data: [] });
  mockElectronAPI.getNamespaces.mockResolvedValue({
    success: true,
    data: [],
  });
  mockElectronAPI.getResources.mockResolvedValue({ success: true, data: [] });
  mockElectronAPI.getLogs.mockResolvedValue({ success: true, data: '' });
  mockElectronAPI.describeResource.mockResolvedValue({
    success: true,
    data: '',
  });
  mockElectronAPI.getResourceYaml.mockResolvedValue({
    success: true,
    data: '',
  });
  mockElectronAPI.rolloutRestart.mockResolvedValue({
    success: true,
    data: undefined,
  });
  mockElectronAPI.deleteResource.mockResolvedValue({
    success: true,
    data: undefined,
  });
};

/**
 * Mock a successful cluster creation
 *
 * @param clusterName - Name of the cluster to create
 * @param provider - Cluster provider (kind or k3d)
 */
export const mockSuccessfulClusterCreation = (
  clusterName: string,
  provider: 'kind' | 'k3d' = 'kind'
) => {
  mockElectronAPI.createCluster.mockResolvedValue({
    success: true,
    data: undefined,
  });
};

/**
 * Mock a failed cluster creation
 *
 * @param errorMessage - Error message to return
 */
export const mockFailedClusterCreation = (errorMessage: string) => {
  mockElectronAPI.createCluster.mockResolvedValue({
    success: false,
    error: errorMessage,
  });
};
