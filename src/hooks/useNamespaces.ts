import { useState, useCallback, useEffect } from 'react';

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
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNamespaces = useCallback(async () => {
    if (!contextName) return;

    try {
      setLoading(true);
      const result = await window.electron.getNamespaces(contextName);

      if (result.success && result.namespaces) {
        setNamespaces(['all', ...result.namespaces]);
      } else {
        setError(result.error || 'Failed to fetch namespaces');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [contextName]);

  useEffect(() => {
    fetchNamespaces();
  }, [fetchNamespaces]);

  return {
    namespaces,
    selectedNamespace,
    setSelectedNamespace,
    loading,
    error,
  };
}
