import { useCallback, useEffect, useState, useRef } from 'react';
import { handleError } from '../lib/error-handler';

interface UseResourceModalOptions {
  isOpen: boolean;
  clusterName: string;
  resourceName: string;
  fetchFn: () => Promise<{ success: boolean; data?: string; error?: string }>;
  errorTitle: string;
}

interface UseResourceModalResult {
  content: string;
  loading: boolean;
  copied: boolean;
  error: string | null;
  contentRef: React.RefObject<HTMLPreElement | null>;
  copyToClipboard: () => void;
}

export function useResourceModal({
  isOpen,
  clusterName,
  resourceName,
  fetchFn,
  errorTitle,
}: UseResourceModalOptions): UseResourceModalResult {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLPreElement>(null);

  // Callers pass `fetchFn` inline, so it changes on every render. Reading it
  // through a ref keeps `load` stable and the effect below from refetching
  // on each render.
  const fetchFnRef = useRef(fetchFn);
  const errorTitleRef = useRef(errorTitle);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
    errorTitleRef.current = errorTitle;
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFnRef.current();
      if (result.success) {
        setContent(result.data ?? '');
      } else {
        const msg = result.error ?? 'Unknown error';
        setError(msg);
        handleError(new Error(msg), errorTitleRef.current);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setError(msg);
      handleError(err as Error, errorTitleRef.current);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && resourceName && clusterName) {
      load();
    }
  }, [isOpen, resourceName, clusterName, load]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return { content, loading, copied, error, contentRef, copyToClipboard };
}
