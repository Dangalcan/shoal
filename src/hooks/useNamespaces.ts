import { useState, useCallback } from 'react';
import { useAsyncData } from './useAsyncData';
import { useApi } from '../services/api-context';

interface UseNamespacesResult {
  namespaces: string[];
  selectedNamespace: string;
  setSelectedNamespace: (ns: string) => void;
  loading: boolean;
  error: string | null;
}

export function useNamespaces(
  contextName: string | undefined
): UseNamespacesResult {
  const api = useApi();
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');

  const fetchFn = useCallback(async () => {
    if (!contextName) return [];

    const result = await api.getNamespaces(contextName);

    if (result.success) {
      return ['all', ...result.data];
    }

    throw new Error(result.error);
  }, [api, contextName]);

  const {
    data: namespaces,
    loading,
    error,
  } = useAsyncData({
    fetchFn,
    errorTitle: 'Namespaces Error',
    skipInitialFetch: !contextName,
    dependencies: [contextName],
  });

  return {
    namespaces: namespaces || [],
    selectedNamespace,
    setSelectedNamespace,
    loading,
    error,
  };
}
