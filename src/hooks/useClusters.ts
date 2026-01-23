import { useClusterContext } from '../features/clusters/ClusterContext';

/**
 * Hook to access global cluster state and actions.
 * Consumes the global ClusterContext to ensure all components stay in sync.
 */
export function useClusters() {
  const context = useClusterContext();

  return {
    clusters: context.clusters,
    loading: context.loading,
    deleting: context.deleting,
    currentContext: context.currentContext,
    switching: context.switching,
    fetchClusters: context.fetchClusters,
    deleteCluster: context.deleteCluster,
    switchContext: context.switchContext,
  };
}
