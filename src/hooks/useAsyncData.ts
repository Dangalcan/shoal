import { useState, useCallback, useEffect, useId, useRef } from 'react';
import { handleError } from '../lib/error-handler';
import { Result, isResult } from '../types/result';

/**
 * Options for the useAsyncData hook.
 */
export interface UseAsyncDataOptions<T> {
  /** Function to fetch the data - can return T or Result<T> */
  fetchFn: () => Promise<T | Result<T>>;
  /** Optional error title for toast notifications */
  errorTitle?: string;
  /** Auto-refresh interval in milliseconds (0 to disable) */
  autoRefreshInterval?: number;
  /** Skip the initial fetch on mount */
  skipInitialFetch?: boolean;
  /** Dependencies that trigger a refetch when changed */
  dependencies?: unknown[];
}

/**
 * Result returned by useAsyncData hook.
 */
export interface UseAsyncDataResult<T> {
  /** The fetched data (null if not yet loaded or error occurred) */
  data: T | null;
  /** Loading state */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Function to manually trigger a refetch */
  refetch: () => Promise<void>;
}

/**
 * Generic hook for fetching data with loading states, error handling, and auto-refresh.
 *
 * This hook provides a consistent pattern for data fetching across the application:
 * - Automatic loading state management
 * - Error handling with toast notifications
 * - Race condition prevention
 * - Auto-refresh support
 * - Manual refetch capability
 * - Support for Result<T> return types
 *
 * @param options - Configuration options
 * @returns Object with data, loading, error, and refetch
 */
export function useAsyncData<T>(
  options: UseAsyncDataOptions<T>
): UseAsyncDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!options.skipInitialFetch);
  const [error, setError] = useState<string | null>(null);
  const requestCounter = useRef(0);

  // Use refs for functions and options to avoid re-render loops
  const fetchFnRef = useRef(options.fetchFn);
  const errorTitleRef = useRef(options.errorTitle);

  // Keep the refs current after every commit. Effects run in declaration
  // order, so the fetch effect below always sees the latest options.
  useEffect(() => {
    fetchFnRef.current = options.fetchFn;
    errorTitleRef.current = options.errorTitle;
  });

  // One toast per distinct failure: an auto-refresh that keeps failing the
  // same way (cluster down, kubectl missing) must not stack a toast every
  // interval. The id also lets a new failure replace the previous toast.
  const lastToastedError = useRef<string | null>(null);
  const toastId = `async-data-${useId()}`;
  const reportError = (err: unknown, message: string) => {
    if (!errorTitleRef.current || lastToastedError.current === message) return;
    lastToastedError.current = message;
    handleError(err, errorTitleRef.current, { id: toastId });
  };

  const fetchData = useCallback(async () => {
    const requestId = ++requestCounter.current;

    try {
      setLoading(true);
      setError(null);

      const result = await fetchFnRef.current();

      // If a newer request has started, ignore this result
      if (requestId !== requestCounter.current) return;

      if (isResult(result)) {
        if (result.success) {
          lastToastedError.current = null;
          setData(result.data);
        } else {
          setError(result.error);
          setData(null);
          reportError(new Error(result.error), result.error);
        }
      } else {
        lastToastedError.current = null;
        setData(result as T);
      }
    } catch (err) {
      if (requestId === requestCounter.current) {
        const errorMsg =
          err instanceof Error ? err.message : 'An error occurred';
        setError(errorMsg);
        setData(null);
        reportError(err, errorMsg);
      }
    } finally {
      if (requestId === requestCounter.current) {
        setLoading(false);
      }
    }
  }, []); // fetchData is now stable because it uses refs

  // Main fetch effect - triggers on mount and when dependencies change
  useEffect(() => {
    if (options.skipInitialFetch) {
      setLoading(false);
      return;
    }

    // Clear data and error when dependencies change to show loading state
    setData(null);
    setError(null);

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, options.skipInitialFetch, ...(options.dependencies || [])]);

  // Auto-refresh effect
  useEffect(() => {
    if (options.autoRefreshInterval && options.autoRefreshInterval > 0) {
      const interval = setInterval(() => {
        if (!options.skipInitialFetch) {
          fetchData();
        }
      }, options.autoRefreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, options.autoRefreshInterval, options.skipInitialFetch]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}
