import { execPromise } from '../../utils/exec-utils';
import { getErrorMessage } from '../../utils/error-utils';
import { pluginEventBus } from '../plugins/plugin-events';
import log from '../../logger';

export class ClusterManagementService {
  async deleteCluster(
    contextName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      contextName = contextName.trim();
      let clusterName = contextName;
      let tool: 'kind' | 'k3d' | 'other' = 'other';

      if (contextName.startsWith('kind-') || contextName === 'kind') {
        clusterName =
          contextName === 'kind' ? 'kind' : contextName.replace('kind-', '');
        tool = 'kind';
      } else if (contextName.startsWith('k3d-') || contextName === 'k3d') {
        clusterName =
          contextName === 'k3d' ? 'k3d' : contextName.replace('k3d-', '');
        tool = 'k3d';
      }

      log.info(
        `[ClusterManager] Detected tool: ${tool}, Cluster Name: ${clusterName}, Context: ${contextName}`
      );

      if (tool === 'kind') {
        log.info(
          `[ClusterManager] Executing: kind delete cluster --name ${clusterName}`
        );
        await execPromise(`kind delete cluster --name ${clusterName}`);
        log.info(
          `[ClusterManager] Kind deletion command completed for ${clusterName}`
        );
      } else if (tool === 'k3d') {
        log.info(
          `[ClusterManager] Executing: k3d cluster delete ${clusterName}`
        );
        await execPromise(`k3d cluster delete ${clusterName}`);
        log.info(
          `[ClusterManager] K3d deletion command completed for ${clusterName}`
        );
      }

      // Always check if the context still exists and remove it if it does
      try {
        log.info(
          `[ClusterManager] Checking if context ${contextName} still exists in kubeconfig`
        );
        const { stdout: contexts } = await execPromise(
          'kubectl config get-contexts -o name'
        );
        const contextList = contexts
          .split(/\r?\n/)
          .map((c) => c.trim())
          .filter(Boolean);

        if (contextList.includes(contextName)) {
          log.info(
            `[ClusterManager] Context "${contextName}" still exists in kubeconfig, removing explicitly.`
          );
          await execPromise(`kubectl config delete-context ${contextName}`);
          log.info(
            `[ClusterManager] Explicit context removal completed for ${contextName}`
          );
        } else {
          log.info(
            `[ClusterManager] Context ${contextName} not found in kubeconfig.`
          );
        }
      } catch (err: unknown) {
        log.warn(
          `[ClusterManager] Failed to check or delete context "${contextName}" from kubeconfig: ${getErrorMessage(err)}`
        );
      }

      // Final verification
      log.info(`[ClusterManager] Final verification for ${contextName}`);
      const { stdout: finalContextListRaw } = await execPromise(
        'kubectl config get-contexts -o name'
      );
      const exists = finalContextListRaw
        .split(/\r?\n/)
        .map((c) => c.trim())
        .includes(contextName);

      if (exists) {
        log.error(
          `[ClusterManager] Verification failed: ${contextName} still exists.`
        );
        return {
          success: false,
          error: `Failed to remove context "${contextName}" from kubeconfig after deletion attempt.`,
        };
      }

      log.info(
        `[ClusterManager] Successfully deleted cluster and removed context ${contextName}`
      );

      // Emit event
      pluginEventBus.emitClusterDisconnected({ name: contextName });

      return { success: true };
    } catch (error: unknown) {
      log.error(
        `[ClusterManager] Unexpected error during cluster deletion: ${getErrorMessage(error)}`
      );
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  async createCluster(
    name: string,
    provider: 'kind' | 'k3d'
  ): Promise<{ success: boolean; error?: string }> {
    const command =
      provider === 'k3d'
        ? `k3d cluster create ${name}`
        : `kind create cluster --name ${name}`;

    log.info(
      `[ClusterManager] Creating cluster ${name} with provider ${provider}`
    );
    try {
      await execPromise(command);
      log.info(`[ClusterManager] Successfully created cluster ${name}`);

      // Emit event
      pluginEventBus.emitClusterConnected({ name, provider });

      return { success: true };
    } catch (error: unknown) {
      log.error(
        `[ClusterManager] Failed to create cluster ${name}: ${getErrorMessage(error)}`
      );
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }
}

export const clusterManagementService = new ClusterManagementService();
