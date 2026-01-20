import { useCallback } from 'react';
import type { K8sResource } from '../types/k8s-types';
import type { ResourceType } from '../lib/resource-definitions';
import { useAsyncData } from './useAsyncData';
import { useApi } from '../services/api-context';

interface UseClusterDataResult {
  items: K8sResource[];
  loading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
}

export function useClusterData(
  contextName: string | undefined,
  resourceType: ResourceType,
  namespace: string
): UseClusterDataResult {
  const api = useApi();

  const fetchFn = useCallback(async () => {
    if (!contextName) return [];

    return api.getResources({
      contextName,
      resourceType,
      namespace,
    });
  }, [api, contextName, resourceType, namespace]);

  const {
    data: items,
    loading,
    error,
    refetch,
  } = useAsyncData({
    fetchFn,
    errorTitle: 'Resource Fetch Error',
    autoRefreshInterval: 30000, // 30 seconds
    skipInitialFetch: !contextName,
    dependencies: [resourceType, contextName, namespace],
  });

  return {
    items: (items || []) as K8sResource[],
    loading,
    error,
    fetchData: refetch,
  };
}
