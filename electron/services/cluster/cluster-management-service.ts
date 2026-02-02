import * as child_process from 'child_process';
import util from 'util';
import { pluginEventBus } from '../plugins/plugin-events';

const execPromise = util.promisify(child_process.exec);

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

      console.log(
        `[ClusterManager] Detected tool: ${tool}, Cluster Name: ${clusterName}, Context: ${contextName}`
      );

      if (tool === 'kind') {
        console.log(
          `[ClusterManager] Executing: kind delete cluster --name ${clusterName}`
        );
        await execPromise(`kind delete cluster --name ${clusterName}`);
        console.log(
          `[ClusterManager] Kind deletion command completed for ${clusterName}`
        );
      } else if (tool === 'k3d') {
        console.log(
          `[ClusterManager] Executing: k3d cluster delete ${clusterName}`
        );
        await execPromise(`k3d cluster delete ${clusterName}`);
        console.log(
          `[ClusterManager] K3d deletion command completed for ${clusterName}`
        );
      }

      // Always check if the context still exists and remove it if it does
      try {
        console.log(
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
          console.log(
            `[ClusterManager] Context "${contextName}" still exists in kubeconfig, removing explicitly.`
          );
          await execPromise(`kubectl config delete-context ${contextName}`);
          console.log(
            `[ClusterManager] Explicit context removal completed for ${contextName}`
          );
        } else {
          console.log(
            `[ClusterManager] Context ${contextName} not found in kubeconfig.`
          );
        }
      } catch (err: any) {
        console.warn(
          `[ClusterManager] Failed to check or delete context "${contextName}" from kubeconfig: ${err.message}`
        );
      }

      // Final verification
      console.log(`[ClusterManager] Final verification for ${contextName}`);
      const { stdout: finalContextListRaw } = await execPromise(
        'kubectl config get-contexts -o name'
      );
      const exists = finalContextListRaw
        .split(/\r?\n/)
        .map((c) => c.trim())
        .includes(contextName);

      if (exists) {
        console.error(
          `[ClusterManager] Verification failed: ${contextName} still exists.`
        );
        return {
          success: false,
          error: `Failed to remove context "${contextName}" from kubeconfig after deletion attempt.`,
        };
      }

      console.log(
        `[ClusterManager] Successfully deleted cluster and removed context ${contextName}`
      );

      // Emit event
      pluginEventBus.emitClusterDisconnected({ name: contextName });

      return { success: true };
    } catch (error: any) {
      console.error(
        `[ClusterManager] Unexpected error during cluster deletion: ${error.message}`
      );
      return { success: false, error: error.message };
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

    console.log(
      `[ClusterManager] Creating cluster ${name} with provider ${provider}`
    );
    try {
      await execPromise(command);
      console.log(`[ClusterManager] Successfully created cluster ${name}`);

      // Emit event
      pluginEventBus.emitClusterConnected({ name, provider });

      return { success: true };
    } catch (error: any) {
      console.error(
        `[ClusterManager] Failed to create cluster ${name}: ${error.message}`
      );
      return { success: false, error: error.message };
    }
  }
}

export const clusterManagementService = new ClusterManagementService();
