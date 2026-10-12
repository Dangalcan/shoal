import { useEffect, useRef, useState } from 'react';
import {
  Terminal as TerminalIcon,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { BaseModal } from './BaseModal';
import { Terminal } from '../Terminal';

interface PodTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  podName: string;
  namespace: string;
  contextName: string;
}

const SHELL_OPTIONS = [
  '/bin/sh',
  '/bin/bash',
  '/bin/ash',
  '/bin/zsh',
  'sh',
  'bash',
];

export function PodTerminalModal({
  isOpen,
  onClose,
  podName,
  namespace,
  contextName,
}: PodTerminalModalProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shell, setShell] = useState('/bin/sh');
  const [retryKey, setRetryKey] = useState(0);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (sessionIdRef.current) {
        window.electron.terminalKill(sessionIdRef.current);
        sessionIdRef.current = null;
      }
      setSessionId(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSessionId(null);

    window.electron
      .terminalCreate({
        kind: 'pod-exec',
        podName,
        namespace,
        contextName,
        shell,
      })
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          sessionIdRef.current = result.data.sessionId;
          setSessionId(result.data.sessionId);
        } else {
          setError(result.error);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (sessionIdRef.current) {
        window.electron.terminalKill(sessionIdRef.current);
        sessionIdRef.current = null;
      }
    };
  }, [isOpen, podName, namespace, contextName, shell, retryKey]);

  const handleRetry = () => setRetryKey((k) => k + 1);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Shell: ${podName}`}
      subtitle={`namespace: ${namespace}  |  context: ${contextName}`}
      icon={<TerminalIcon size={18} />}
      width="90vw"
      maxWidth="1200px"
    >
      <div className="pod-terminal-modal__body">
        <div className="pod-terminal-modal__toolbar">
          <span className="pod-terminal-modal__shell-label">Shell:</span>
          <select
            value={shell}
            onChange={(e) => setShell(e.target.value)}
            className="pod-terminal-modal__shell-select"
          >
            {SHELL_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {(error || sessionId) && (
            <button
              onClick={handleRetry}
              title="Reconnect"
              className="pod-terminal-modal__reconnect-btn"
            >
              <RefreshCw size={12} />
              Reconnect
            </button>
          )}
        </div>

        <div className="pod-terminal-modal__area">
          {loading && (
            <div className="pod-terminal-modal__status">
              <Loader2 size={20} className="animate-spin" />
              <span>
                Opening {shell} in {podName}...
              </span>
            </div>
          )}
          {error && !loading && (
            <div className="pod-terminal-modal__error">
              <AlertCircle size={32} />
              <p className="pod-terminal-modal__error-msg">{error}</p>
              <p className="pod-terminal-modal__error-hint">
                Try a different shell from the selector above, then click
                Reconnect.
              </p>
            </div>
          )}
          {sessionId && !loading && (
            <Terminal sessionId={sessionId} kind="pod-exec" />
          )}
        </div>
      </div>
    </BaseModal>
  );
}
