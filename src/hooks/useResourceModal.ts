import { useEffect, useState, useRef } from 'react';
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

  useEffect(() => {
    if (isOpen && resourceName && clusterName) {
      fetch();
    }
  }, [isOpen, resourceName, clusterName]);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      if (result.success) {
        setContent(result.data ?? '');
      } else {
        const msg = result.error ?? 'Unknown error';
        setError(msg);
        handleError(new Error(msg), errorTitle);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setError(msg);
      handleError(err as Error, errorTitle);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return { content, loading, copied, error, contentRef, copyToClipboard };
}
