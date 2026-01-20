import { useState, useCallback } from 'react';
import { useAsyncData } from './useAsyncData';

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
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');

  const fetchFn = useCallback(async () => {
    if (!contextName) return [];

    const result = await window.electron.getNamespaces(contextName);

    if (result.success) {
      return ['all', ...result.data];
    }

    throw new Error(result.error);
  }, [contextName]);

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
