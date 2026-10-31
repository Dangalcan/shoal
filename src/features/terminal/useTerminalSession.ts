import { useEffect, useRef, useState } from 'react';
import { useApi } from '../../services/api-context';
import type { ElectronAPI } from '../../types.d';
import type { Result } from '../../types/result';

export type TerminalCreateArgs = Parameters<ElectronAPI['terminalCreate']>[0];
type TerminalCreateData =
  Awaited<ReturnType<ElectronAPI['terminalCreate']>> extends Result<infer T>
    ? T
    : never;

export interface TerminalSessionState {
  /** Id of the running session, null while it starts or after it failed. */
  sessionId: string | null;
  /** Line-ending family reported by the main process for the session. */
  shellFamily: TerminalCreateData['shellFamily'] | null;
  /** True from the request until the main process answered. */
  loading: boolean;
  /** Why the session could not start. */
  error: string | null;
}

/** The answer to one create request, tagged with the request it answers. */
interface SettledRequest {
  key: string;
  result: Result<TerminalCreateData>;
}

/**
 * Owns one terminal session (local shell or pod exec) for the given
 * arguments: it is created when the hook mounts, replaced when the arguments
 * or `attempt` change (the previous session is killed first), and killed when
 * the owner unmounts. `attempt` lets the owner start a fresh session with the
 * same arguments (New Terminal, Retry, Reconnect).
 */
export function useTerminalSession(
  args: TerminalCreateArgs,
  attempt = 0
): TerminalSessionState {
  const api = useApi();
  // The arguments are compared by value, so callers can pass a fresh object
  // on every render without restarting the session.
  const key = `${attempt}:${JSON.stringify(args)}`;
  const argsRef = useRef(args);
  useEffect(() => {
    argsRef.current = args;
  });

  const [settled, setSettled] = useState<SettledRequest | null>(null);
  // Drop the previous answer the moment the request changes (React's "store
  // the previous props in state" pattern), so switching back to earlier
  // arguments never shows a session that was already killed.
  const [settledFor, setSettledFor] = useState(key);
  if (settledFor !== key) {
    setSettledFor(key);
    setSettled(null);
  }

  const sessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void api.terminalCreate(argsRef.current).then((result) => {
      if (cancelled) {
        // The request changed or the owner unmounted while the shell was
        // starting: nobody will use this session, so it is killed at once.
        if (result.success) void api.terminalKill(result.data.sessionId);
        return;
      }
      if (result.success) sessionIdRef.current = result.data.sessionId;
      setSettled({ key, result });
    });
    return () => {
      cancelled = true;
      if (sessionIdRef.current) {
        void api.terminalKill(sessionIdRef.current);
        sessionIdRef.current = null;
      }
    };
  }, [api, key]);

  const result = settled && settled.key === key ? settled.result : null;
  return {
    sessionId: result?.success ? result.data.sessionId : null,
    shellFamily: result?.success ? (result.data.shellFamily ?? null) : null,
    loading: result === null,
    error: result && !result.success ? result.error : null,
  };
}
