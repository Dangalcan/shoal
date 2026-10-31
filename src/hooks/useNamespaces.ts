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

/** A namespace the user picked, with the context and default it was picked under. */
interface NamespaceChoice {
  contextName: string | undefined;
  defaultNamespace: string;
  namespace: string;
}

export function useNamespaces(
  contextName: string | undefined
): UseNamespacesResult {
  const api = useApi();
  const [defaultNamespace] = useLocalStorage<string>(
    'k8s_desktop_default_namespace',
    ''
  );
  // The selection is derived: it holds while the context and the default
  // setting stay the same, and falls back to the default (or "all") as soon
  // as either changes.
  const [choice, setChoice] = useState<NamespaceChoice | null>(null);
  const selectedNamespace =
    choice &&
    choice.contextName === contextName &&
    choice.defaultNamespace === defaultNamespace
      ? choice.namespace
      : defaultNamespace || 'all';
  const setSelectedNamespace = useCallback(
    (namespace: string) =>
      setChoice({ contextName, defaultNamespace, namespace }),
    [contextName, defaultNamespace]
  );

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
