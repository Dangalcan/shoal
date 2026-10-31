import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { useApi } from '../../services/api-context';
import { handleAsyncOperation } from '../../lib/async-operation-handler';
import { handleError } from '../../lib/error-handler';
import { useAsyncData } from '../../hooks/useAsyncData';
import { Result } from '../../types/result';
import { ClusterContextValue } from './types';
import { isToolMissingMessage } from '../../lib/tool-errors';

const ClusterContext = createContext<ClusterContextValue | null>(null);

export function ClusterProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [currentContext, setCurrentContext] = useState<string>('');
  const [switching, setSwitching] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchFn = useCallback(async () => {
    return api.getClusters();
  }, [api]);

  const {
    data: clusters,
    loading,
    refetch: fetchClusters,
  } = useAsyncData({
    fetchFn,
    errorTitle: 'Failed to fetch clusters',
    // The Dashboard and the cluster list show a notice with install links
    // when kubectl is missing; a toast saying the same would be noise.
    shouldReport: (message) => !isToolMissingMessage(message),
  });

  // Fetch current context on mount and after cluster list changes
  useEffect(() => {
    const fetchCurrentContext = async () => {
      const result = await api.getCurrentContext();
      if (result.success) {
        setCurrentContext(result.data);
      }
    };
    fetchCurrentContext().catch((err) =>
      handleError(err, 'Failed to read the current context')
    );
  }, [api, clusters]);

  const deleteCluster = useCallback(
    async (name: string): Promise<Result> => {
      setDeleting(name);

      const result = await handleAsyncOperation(() => api.deleteCluster(name), {
        loadingMessage: `Deleting cluster "${name}"...`,
        successMessage: `Cluster "${name}" deleted.`,
        errorTitle: 'Failed to delete cluster',
        onSuccess: async () => {
          // If we deleted the current context, clear it immediately
          if (name === currentContext) {
            setCurrentContext('');
          }
          await fetchClusters();
        },
      });

      setDeleting(null);
      return result;
    },
    [api, fetchClusters, currentContext]
  );

  const switchContext = useCallback(
    async (contextName: string): Promise<Result<void>> => {
      setSwitching(contextName);

      const result = await handleAsyncOperation(
        async () => {
          const apiResult = await api.switchContext(contextName);
          if (apiResult.success) {
            return { success: true, data: undefined };
          }
          return apiResult;
        },
        {
          loadingMessage: `Switching to context "${contextName}"...`,
          successMessage: `Switched to context "${contextName}".`,
          errorTitle: 'Failed to switch context',
          // The Default Namespace setting is the user's choice and survives a
          // context switch; useNamespaces re-applies it for the new context.
          onSuccess: async () => {
            setCurrentContext(contextName);
            await fetchClusters();
          },
        }
      );

      setSwitching(null);
      return result;
    },
    [api, fetchClusters]
  );

  const value: ClusterContextValue = {
    clusters: clusters || [],
    loading,
    currentContext,
    switching,
    deleting,
    fetchClusters,
    switchContext,
    deleteCluster,
  };

  return (
    <ClusterContext.Provider value={value}>{children}</ClusterContext.Provider>
  );
}

export function useClusterContext() {
  const context = useContext(ClusterContext);
  if (!context) {
    throw new Error('useClusterContext must be used within a ClusterProvider');
  }
  return context;
}
