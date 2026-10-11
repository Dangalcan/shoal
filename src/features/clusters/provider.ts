export type LocalClusterProvider = 'kind' | 'k3d';

/**
 * The local cluster tool behind a kubeconfig context, from its name prefix.
 * Same rule the main process uses to pick `kind` or `k3d` when deleting a
 * cluster (electron/services/cluster/cluster-management-service.ts).
 * Any other context returns null.
 */
export function providerFromContext(
  context: string
): LocalClusterProvider | null {
  if (context === 'kind' || context.startsWith('kind-')) return 'kind';
  if (context === 'k3d' || context.startsWith('k3d-')) return 'k3d';
  return null;
}
