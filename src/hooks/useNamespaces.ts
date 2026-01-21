import { useState, useCallback } from 'react';
import { useAsyncData } from './useAsyncData';
import { useApi } from '../services/api-context';
import { mapResult } from '../types/result';
import { useLocalStorage } from './useLocalStorage';

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
  const [defaultNamespace] = useLocalStorage<string>(
    'k8s_desktop_default_namespace',
    ''
  );
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');

  // Set default namespace on mount if configured and no selection
  useState(() => {
    if (defaultNamespace && defaultNamespace !== 'all') {
      setSelectedNamespace(defaultNamespace);
    }
  });

  const fetchFn = useCallback(async () => {
    if (!contextName) return [];

    const result = await api.getNamespaces(contextName);
    return mapResult(result, (data) => ['all', ...data]);
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
