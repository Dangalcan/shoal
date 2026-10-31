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
  /**
   * Decides whether a failure is reported with a toast (default: always).
   * Pages that already explain a failure on screen, such as a missing
   * kubectl, return false for it.
   */
  shouldReport?: (message: string) => boolean;
}

/**
 * Result returned by useAsyncData hook.
 */
export interface UseAsyncDataResult<T> {
  /**
   * The fetched data: null until the first success, then the last
   * successful value, which stays on screen while a refresh fails.
   */
  data: T | null;
  /** True while a fetch (initial or refresh) is in flight */
  loading: boolean;
  /** Message of the last failed fetch; cleared by the next success */
  error: string | null;
  /** Function to manually trigger a refetch */
  refetch: () => Promise<void>;
}

/** Element-wise identity comparison of two dependency lists. */
function sameDependencies(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
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
  const skip = options.skipInitialFetch === true;
  const dependencies = options.dependencies ?? [];
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState<string | null>(null);
  const requestCounter = useRef(0);

  // Use refs for functions and options to avoid re-render loops
  const fetchFnRef = useRef(options.fetchFn);
  const errorTitleRef = useRef(options.errorTitle);
  const shouldReportRef = useRef(options.shouldReport);

  // Keep the refs current after every commit. Effects run in declaration
  // order, so the fetch effect below always sees the latest options.
  useEffect(() => {
    fetchFnRef.current = options.fetchFn;
    errorTitleRef.current = options.errorTitle;
    shouldReportRef.current = options.shouldReport;
  });

  // A changed dependency list starts from a blank slate, so the previous
  // data and error never show as the new request's while it loads; switching
  // the initial fetch off only stops the spinner. Adjusting state during
  // render, keyed on the previous inputs, is React's pattern for "reset when
  // a prop changes": no effect, and no committed frame with the stale values.
  const [seen, setSeen] = useState({ dependencies, skip });
  if (
    seen.skip !== skip ||
    !sameDependencies(seen.dependencies, dependencies)
  ) {
    setSeen({ dependencies, skip });
    if (skip) {
      setLoading(false);
    } else {
      setData(null);
      setError(null);
      setLoading(true);
    }
  }

  // One toast per distinct failure: an auto-refresh that keeps failing the
  // same way (cluster down, kubectl missing) must not stack a toast every
  // interval. The id also lets a new failure replace the previous toast.
  const lastToastedError = useRef<string | null>(null);
  const toastId = `async-data-${useId()}`;
  const reportError = useCallback(
    (err: unknown, message: string) => {
      if (!errorTitleRef.current || lastToastedError.current === message) {
        return;
      }
      if (shouldReportRef.current?.(message) === false) return;
      lastToastedError.current = message;
      handleError(err, errorTitleRef.current, { id: toastId });
    },
    [toastId]
  );

  // Runs one fetch and stores its outcome. The loading state is already on
  // when this starts: from the initial render, the reset above or `refetch`.
  const runFetch = useCallback(async () => {
    const requestId = ++requestCounter.current;

    try {
      const result = await fetchFnRef.current();

      // If a newer request has started, ignore this result
      if (requestId !== requestCounter.current) return;

      if (isResult(result)) {
        if (result.success) {
          lastToastedError.current = null;
          setData(result.data);
          setError(null);
        } else {
          setError(result.error);
          reportError(new Error(result.error), result.error);
        }
      } else {
        lastToastedError.current = null;
        setData(result as T);
        setError(null);
      }
    } catch (err) {
      if (requestId === requestCounter.current) {
        const errorMsg =
          err instanceof Error ? err.message : 'An error occurred';
        setError(errorMsg);
        reportError(err, errorMsg);
      }
    } finally {
      if (requestId === requestCounter.current) {
        setLoading(false);
      }
    }
  }, [reportError]); // stable: the options are read through refs

  // A refresh keeps the current data and error on screen until it has a
  // result of its own: an unreachable cluster must not turn the page into a
  // spinner every interval.
  const refetch = useCallback(async () => {
    setLoading(true);
    await runFetch();
  }, [runFetch]);

  // Main fetch effect - triggers on mount and when dependencies change
  useEffect(() => {
    if (skip) return;
    void runFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runFetch, skip, ...dependencies]);

  // Auto-refresh effect
  useEffect(() => {
    if (options.autoRefreshInterval && options.autoRefreshInterval > 0) {
      const interval = setInterval(() => {
        if (!options.skipInitialFetch) {
          void refetch();
        }
      }, options.autoRefreshInterval);
      return () => clearInterval(interval);
    }
  }, [refetch, options.autoRefreshInterval, options.skipInitialFetch]);

  return {
    data,
    loading,
    error,
    refetch,
  };
}
