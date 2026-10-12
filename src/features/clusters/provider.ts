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

/**
 * Wording for the delete confirmation. Only kind and k3d clusters are
 * actually destroyed; for any other context the app removes the kubeconfig
 * entry and the cluster itself is untouched, so the dialog must not promise
 * a deletion.
 */
export function deleteClusterDialogText(context: string): {
  title: string;
  message: string;
  confirmLabel: string;
} {
  if (providerFromContext(context)) {
    return {
      title: 'Delete Cluster',
      message: `Are you sure you want to delete cluster "${context}"? This action cannot be undone.`,
      confirmLabel: 'Delete Cluster',
    };
  }
  return {
    title: 'Remove Context',
    message: `Remove "${context}" from your kubeconfig? The cluster itself is not touched; you can add the context again later.`,
    confirmLabel: 'Remove Context',
  };
}
