import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export class ClusterManagementService {
  async deleteCluster(
    contextName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      let clusterName = contextName;
      let tool: 'kind' | 'k3d' | 'other' = 'other';

      if (contextName.startsWith('kind-')) {
        clusterName = contextName.replace('kind-', '');
        tool = 'kind';
      } else if (contextName.startsWith('k3d-')) {
        clusterName = contextName.replace('k3d-', '');
        tool = 'k3d';
      }

      console.log(
        `Attempting to delete cluster "${clusterName}" using tool "${tool}" (context: ${contextName})`
      );

      if (tool === 'kind') {
        try {
          await execPromise(`kind delete cluster --name ${clusterName}`);
        } catch (err: any) {
          console.warn(
            `Kind deletion failed for "${clusterName}", might already be gone or not a kind cluster. Proceeding to manual context removal.`
          );
        }
      } else if (tool === 'k3d') {
        try {
          await execPromise(`k3d cluster delete ${clusterName}`);
        } catch (err: any) {
          console.warn(
            `K3d deletion failed for "${clusterName}", might already be gone or not a k3d cluster. Proceeding to manual context removal.`
          );
        }
      }

      // Always check if the context still exists and remove it if it does
      try {
        const { stdout: contexts } = await execPromise(
          'kubectl config get-contexts -o name'
        );
        if (
          contexts
            .split('\n')
            .map((c) => c.trim())
            .includes(contextName)
        ) {
          console.log(
            `Context "${contextName}" still exists in kubeconfig, removing explicitly.`
          );
          await execPromise(`kubectl config delete-context ${contextName}`);
        }
      } catch (err: any) {
        console.warn(
          `Failed to check or delete context "${contextName}" from kubeconfig: ${err.message}`
        );
      }

      // Final verification
      const { stdout: finalContexts } = await execPromise(
        'kubectl config get-contexts -o name'
      );
      const exists = finalContexts
        .split('\n')
        .map((c) => c.trim())
        .includes(contextName);

      if (exists) {
        return {
          success: false,
          error: `Failed to remove context "${contextName}" from kubeconfig after deletion attempt.`,
        };
      }

      return { success: true };
    } catch (error: any) {
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

    try {
      await execPromise(command);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const clusterManagementService = new ClusterManagementService();
