import { useState, useCallback, useEffect } from 'react';
import { handleError } from '../lib/error-handler';

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
      setError(null);
      const result = await window.electron.getNamespaces(contextName);

      if (result.success && result.namespaces) {
        setNamespaces(['all', ...result.namespaces]);
      } else {
        const errorMsg = result.error || 'Failed to fetch namespaces';
        setError(errorMsg);
        handleError(errorMsg, 'Namespaces Error');
      }
    } catch (err: any) {
      setError(err.message);
      handleError(err, 'Namespaces Error');
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
