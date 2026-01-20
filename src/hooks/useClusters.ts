import { useState, useCallback } from 'react';
import { electronService } from '../services/electronService';
import { handleAsyncOperation } from '../lib/async-operation-handler';
import { useAsyncData } from './useAsyncData';

export interface ClusterDeleteResult {
  success: boolean;
  error?: string;
}

export function useClusters() {
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchFn = useCallback(async () => {
    const result = await electronService.getClusters();

    if (result.success) {
      return result.data;
    }

    throw new Error(result.error);
  }, []);

  const {
    data: clusters,
    loading,
    refetch: fetchClusters,
  } = useAsyncData({
    fetchFn,
    errorTitle: 'Failed to fetch clusters',
  });

  const deleteCluster = useCallback(
    async (name: string): Promise<ClusterDeleteResult> => {
      setDeleting(name);

      const result = await handleAsyncOperation(
        () => electronService.deleteCluster(name),
        {
          loadingMessage: `Deleting cluster "${name}"...`,
          successMessage: `Cluster "${name}" deleted.`,
          errorTitle: 'Failed to delete cluster',
          onSuccess: fetchClusters,
        }
      );

      setDeleting(null);
      return result;
    },
    [fetchClusters]
  );

  return {
    clusters: clusters || [],
    loading,
    deleting,
    fetchClusters,
    deleteCluster,
  };
}
