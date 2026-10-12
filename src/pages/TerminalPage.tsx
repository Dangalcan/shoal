import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Terminal as TerminalIcon,
  Loader2,
  AlertCircle,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { Terminal } from '../components/Terminal';
import type { LocalShellInfo } from '../types';
import { useApi } from '../services/api-context';

export function TerminalPage() {
  const api = useApi();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [shells, setShells] = useState<LocalShellInfo[]>([]);
  const [defaultShell, setDefaultShell] = useState<string>('');
  // null = backend default; set only by explicit user selection
  const [shell, setShell] = useState<string | null>(null);
  // Known as soon as the session exists, so the terminal is created once
  // with the right line endings instead of being recreated (and losing its
  // first output) when the shell list arrives.
  const [shellFamily, setShellFamily] = useState<'windows' | 'unix' | null>(
    null
  );
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    api.terminalShells().then((result) => {
      if (result.success && result.data) {
        setShells(result.data.shells);
        setDefaultShell(result.data.defaultShell);
      }
    });
  }, []);

  const startSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSessionId(null);
    const result = await api.terminalCreate({
      kind: 'local',
      shell: shell ?? undefined,
    });
    if (result.success) {
      sessionIdRef.current = result.data.sessionId;
      setShellFamily(result.data.shellFamily ?? null);
      setSessionId(result.data.sessionId);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [shell]);

  useEffect(() => {
    startSession();
    return () => {
      if (sessionIdRef.current) {
        api.terminalKill(sessionIdRef.current);
        sessionIdRef.current = null;
      }
    };
  }, [sessionKey, startSession]);

  const handleNewTerminal = () => {
    setSessionKey((k) => k + 1);
  };

  const activeShellId = shell ?? defaultShell;
  const activeShell = shells.find((s) => s.id === activeShellId);

  return (
    <div className="terminal-page">
      <div className="terminal-page__header">
        <div className="terminal-page__title">
          <TerminalIcon size={18} color="var(--color-primary)" />
          <span className="terminal-page__title-text">Terminal</span>
          {sessionId && !loading && (
            <span className="terminal-page__session-badge">
              {activeShell?.label ?? 'Shell'}
            </span>
          )}
        </div>
        <div className="terminal-page__actions">
          {shells.length > 0 && (
            <div className="terminal-page__shell-picker">
              <select
                value={activeShellId}
                onChange={(e) => setShell(e.target.value)}
                className="terminal-page__shell-select"
                aria-label="Shell type"
                title="Select shell type"
              >
                {shells.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="terminal-page__shell-chevron"
                aria-hidden
              />
            </div>
          )}
          <button
            onClick={handleNewTerminal}
            className="terminal-page__new-btn"
            title="New Terminal"
          >
            <Plus size={14} />
            New Terminal
          </button>
        </div>
      </div>

      <div className="terminal-page__body">
        {loading && (
          <div className="terminal-page__status">
            <Loader2 size={20} className="animate-spin" />
            <span>Starting terminal...</span>
          </div>
        )}
        {error && !loading && (
          <div className="terminal-page__error">
            <AlertCircle size={32} />
            <p style={{ margin: 0 }}>{error}</p>
            <button
              onClick={handleNewTerminal}
              className="terminal-page__retry-btn"
            >
              Retry
            </button>
          </div>
        )}
        {sessionId && !loading && (
          <div className="terminal-page__terminal-wrap">
            <Terminal
              sessionId={sessionId}
              kind="local"
              shellFamily={shellFamily ?? activeShell?.family}
            />
          </div>
        )}
      </div>
    </div>
  );
}
