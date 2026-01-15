/**
 * Electron API Test Helpers
 *
 * Helper functions for setting up and managing Electron API mocks in tests.
 * These helpers reduce duplication and provide consistent mock behavior.
 */

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
  currentContext: string = 'None'
) => {
  mockElectronAPI.getClusters.mockResolvedValue(clusters);
  mockElectronAPI.getCurrentContext.mockResolvedValue(currentContext);
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
export const mockToolStatus = (tools: Record<string, boolean>) => {
  mockElectronAPI.checkTool.mockImplementation(async (tool: string) => {
    return tools[tool] ?? false;
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
  const response = { success, items };

  switch (resourceType) {
    case 'pods':
      mockElectronAPI.getPods.mockResolvedValue({ success, pods: items });
      break;
    case 'namespaces':
      mockElectronAPI.getNamespaces.mockResolvedValue({
        success,
        namespaces: items,
      });
      break;
    case 'resources':
      mockElectronAPI.getResources.mockResolvedValue(response);
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
  mockElectronAPI.runCommand.mockResolvedValue({
    success: true,
    stdout: '',
    stderr: '',
  });
  mockElectronAPI.checkTool.mockResolvedValue(true);
  mockElectronAPI.createCluster.mockResolvedValue({ success: true });
  mockElectronAPI.getClusters.mockResolvedValue([]);
  mockElectronAPI.deleteCluster.mockResolvedValue({ success: true });
  mockElectronAPI.getCurrentContext.mockResolvedValue('None');
  mockElectronAPI.getPods.mockResolvedValue({ success: true, pods: [] });
  mockElectronAPI.getNamespaces.mockResolvedValue({
    success: true,
    namespaces: [],
  });
  mockElectronAPI.getResources.mockResolvedValue({ success: true, items: [] });
  mockElectronAPI.getLogs.mockResolvedValue({ success: true, logs: '' });
  mockElectronAPI.describeResource.mockResolvedValue({
    success: true,
    output: '',
  });
  mockElectronAPI.getResourceYaml.mockResolvedValue({
    success: true,
    yaml: '',
  });
  mockElectronAPI.rolloutRestart.mockResolvedValue({ success: true });
  mockElectronAPI.deleteResource.mockResolvedValue({ success: true });
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
    message: `Cluster ${clusterName} created successfully`,
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

/**
 * Mock cluster deletion
 *
 * @param success - Whether deletion should succeed
 * @param errorMessage - Error message if deletion fails
 */
export const mockClusterDeletion = (
  success: boolean = true,
  errorMessage?: string
) => {
  mockElectronAPI.deleteCluster.mockResolvedValue({
    success,
    error: errorMessage,
  });
};
