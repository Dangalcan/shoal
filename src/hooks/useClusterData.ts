import { useState, useCallback, useEffect, useRef } from 'react';
import type { K8sResource } from '../types/k8s-types';
import type { ResourceType } from '../lib/resource-definitions';

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
  const [items, setItems] = useState<K8sResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestCounter = useRef(0);

  // Clear items when resource type changes to prevent stale data schema mismatch
  useEffect(() => {
    setItems([]);
    setError(null);
    // Increment counter on change to invalidate any pending fetches
    requestCounter.current++;
  }, [resourceType, contextName, namespace]);

  const fetchData = useCallback(async () => {
    if (!contextName) return;

    const requestId = ++requestCounter.current;

    try {
      setLoading(true);
      setError(null);

      const result = await window.electron.getResources({
        contextName,
        resourceType,
        namespace,
      });

      // If a newer request has started, ignore this result
      if (requestId !== requestCounter.current) return;

      if (result.success && result.items) {
        setItems(result.items);
      } else {
        setError(result.error || 'Failed to fetch resources');
        setItems([]);
      }
    } catch (err: any) {
      if (requestId !== requestCounter.current) return;
      setError(err.message || 'An error occurred');
      setItems([]);
    } finally {
      if (requestId === requestCounter.current) {
        setLoading(false);
      }
    }
  }, [contextName, resourceType, namespace]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { items, loading, error, fetchData };
}
