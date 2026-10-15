import { useEffect, useRef, useState } from 'react';
import { useApi } from '../../services/api-context';

/** Lines kept while following; older ones are dropped. */
export const MAX_BUFFERED_LINES = 5_000;

export type LogStreamState =
  | { status: 'connecting' }
  | { status: 'live' }
  | { status: 'ended'; reason: string };

export interface LogBuffer {
  lines: string[];
  /** True once older lines were dropped to stay under MAX_BUFFERED_LINES. */
  truncated: boolean;
  /** A get-logs snapshot, or what a (possibly stopped) stream sent. */
  source: 'snapshot' | 'stream';
}

export const EMPTY_LOG_BUFFER: LogBuffer = {
  lines: [],
  truncated: false,
  source: 'snapshot',
};

/** Appends streamed lines, keeping only the newest MAX_BUFFERED_LINES. */
export function appendLogLines(buffer: LogBuffer, lines: string[]): LogBuffer {
  const all = buffer.lines.concat(lines);
  if (all.length <= MAX_BUFFERED_LINES) {
    return { lines: all, truncated: buffer.truncated, source: 'stream' };
  }
  return {
    lines: all.slice(-MAX_BUFFERED_LINES),
    truncated: true,
    source: 'stream',
  };
}

export interface UseLogStreamOptions {
  /** Follow is on and the viewer is open. */
  enabled: boolean;
  contextName: string;
  podName: string;
  namespace: string;
  container?: string;
  /** kubectl started: the stream re-sends the last 200 lines next. */
  onStarted: () => void;
  onLines: (lines: string[]) => void;
}

export interface UseLogStreamResult {
  stream: LogStreamState;
  /** Starts a new stream after the previous one ended. */
  reconnect: () => void;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An unexpected error occurred';
}

/**
 * Follow mode of the log viewer: one `kubectl logs -f` per pod, container
 * and attempt. Disabling it, or changing the pod or container, stops the
 * running stream; a stream that stops on its own reports why.
 */
export function useLogStream({
  enabled,
  contextName,
  podName,
  namespace,
  container,
  onStarted,
  onLines,
}: UseLogStreamOptions): UseLogStreamResult {
  const api = useApi();
  const [stream, setStream] = useState<LogStreamState>({
    status: 'connecting',
  });
  const [attempt, setAttempt] = useState(0);
  // The latest callbacks, without restarting the stream when they change.
  const handlersRef = useRef({ onStarted, onLines });
  useEffect(() => {
    handlersRef.current = { onStarted, onLines };
  });

  useEffect(() => {
    if (!enabled || !podName || !namespace || !contextName) return;
    let active = true;
    let streamId: string | null = null;

    const offLines = api.onLogStreamLines((id, lines) => {
      if (active && id === streamId) handlersRef.current.onLines(lines);
    });
    const offEnded = api.onLogStreamEnded((id, end) => {
      if (!active || id !== streamId) return;
      streamId = null;
      setStream({ status: 'ended', reason: end.reason });
    });

    api
      .logStreamStart({ contextName, podName, namespace, container })
      .then((result) => {
        if (!active) {
          // Stopped before kubectl started: stop it now.
          if (result.success) void api.logStreamStop(result.data.streamId);
          return;
        }
        if (!result.success) {
          setStream({ status: 'ended', reason: result.error });
          return;
        }
        streamId = result.data.streamId;
        setStream({ status: 'live' });
        handlersRef.current.onStarted();
      })
      .catch((err: unknown) => {
        if (active) setStream({ status: 'ended', reason: errorMessage(err) });
      });

    return () => {
      active = false;
      offLines();
      offEnded();
      if (streamId) void api.logStreamStop(streamId);
      setStream({ status: 'connecting' });
    };
  }, [api, enabled, contextName, podName, namespace, container, attempt]);

  return { stream, reconnect: () => setAttempt((n) => n + 1) };
}
