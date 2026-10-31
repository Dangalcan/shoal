import { useEffect, useState, useRef } from 'react';
import { handleError } from '../lib/error-handler';

interface UseResourceModalOptions {
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

/** The settled outcome of one fetch, tagged with the resource it was for. */
interface FetchOutcome {
  target: string;
  content: string;
  error: string | null;
}

/**
 * Loads the text a modal shows for one resource (describe output, YAML) when
 * the hook mounts and whenever the resource changes. The modals mount it
 * only while open, so every opening fetches afresh.
 */
export function useResourceModal({
  clusterName,
  resourceName,
  fetchFn,
  errorTitle,
}: UseResourceModalOptions): UseResourceModalResult {
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLPreElement>(null);

  // Callers pass `fetchFn` inline, so it changes on every render. Reading it
  // through a ref keeps the effect below from refetching on each render.
  const fetchFnRef = useRef(fetchFn);
  const errorTitleRef = useRef(errorTitle);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
    errorTitleRef.current = errorTitle;
  });

  // The outcome is kept with the resource it belongs to, so a different
  // resource shows a blank loading state until its own fetch settles: the
  // previous text would flash for a frame, survive a failed fetch, and a
  // YAML "Save to DB" during loading would store it under the new name.
  const target =
    resourceName && clusterName ? `${clusterName}/${resourceName}` : null;
  const [outcome, setOutcome] = useState<FetchOutcome | null>(null);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    const load = async () => {
      try {
        const result = await fetchFnRef.current();
        if (cancelled) return;
        if (result.success) {
          setOutcome({ target, content: result.data ?? '', error: null });
        } else {
          const msg = result.error ?? 'Unknown error';
          setOutcome({ target, content: '', error: msg });
          handleError(new Error(msg), errorTitleRef.current);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'An error occurred';
        setOutcome({ target, content: '', error: msg });
        handleError(err as Error, errorTitleRef.current);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [target]);

  const current = outcome && outcome.target === target ? outcome : null;
  const content = current?.content ?? '';

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => handleError(err, 'Could not copy to the clipboard'));
  };

  return {
    content,
    loading: target !== null && current === null,
    copied,
    error: current?.error ?? null,
    contentRef,
    copyToClipboard,
  };
}
