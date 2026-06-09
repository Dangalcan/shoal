import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as TerminalIcon, Loader2, AlertCircle, Plus } from 'lucide-react';
import { Terminal } from '../components/Terminal';

export function TerminalPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const sessionIdRef = useRef<string | null>(null);

  const startSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSessionId(null);
    const result = await window.electron.terminalCreate({ kind: 'local' });
    if (result.success) {
      sessionIdRef.current = result.data.sessionId;
      setSessionId(result.data.sessionId);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    startSession();
    return () => {
      if (sessionIdRef.current) {
        window.electron.terminalKill(sessionIdRef.current);
        sessionIdRef.current = null;
      }
    };
  }, [sessionKey, startSession]);

  const handleNewTerminal = () => {
    setSessionKey((k) => k + 1);
  };

  return (
    <div className="terminal-page">
      <div className="terminal-page__header">
        <div className="terminal-page__title">
          <TerminalIcon size={18} color="var(--color-primary)" />
          <span className="terminal-page__title-text">Terminal</span>
          {sessionId && !loading && (
            <span className="terminal-page__session-badge">PowerShell</span>
          )}
        </div>
        <button
          onClick={handleNewTerminal}
          className="terminal-page__new-btn"
          title="New Terminal"
        >
          <Plus size={14} />
          New Terminal
        </button>
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
            <button onClick={handleNewTerminal} className="terminal-page__retry-btn">
              Retry
            </button>
          </div>
        )}
        {sessionId && !loading && (
          <div className="terminal-page__terminal-wrap">
            <Terminal sessionId={sessionId} kind="local" />
          </div>
        )}
      </div>
    </div>
  );
}
