import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { electronService } from '../services/electronService';
import { handleError } from '../lib/error-handler';

export interface ClusterDeleteResult {
  success: boolean;
  error?: string;
}

export function useClusters() {
  const [clusters, setClusters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    try {
      const list = await electronService.getClusters();
      setClusters(list);
    } catch (err) {
      handleError(err, 'Failed to fetch clusters');
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteCluster = useCallback(
    async (name: string): Promise<ClusterDeleteResult> => {
      setDeleting(name);
      const toastId = toast.loading(`Deleting cluster "${name}"...`);

      try {
        const result = await electronService.deleteCluster(name);
        if (result.success) {
          toast.success(`Cluster "${name}" deleted.`, { id: toastId });
          await fetchClusters();
          return { success: true };
        } else {
          const errorMsg = result.error || 'Failed to delete cluster';
          handleError(errorMsg, 'Failed to delete cluster', { id: toastId });
          return { success: false, error: errorMsg };
        }
      } catch (err) {
        handleError(err, 'Failed to delete cluster', { id: toastId });
        return { success: false, error: 'An unexpected error occurred.' };
      } finally {
        setDeleting(null);
      }
    },
    [fetchClusters]
  );

  return {
    clusters,
    loading,
    deleting,
    fetchClusters,
    deleteCluster,
  };
}
