import { useState } from 'react';
import {
  Terminal as TerminalIcon,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { BaseModal } from './BaseModal';
import { Terminal } from '../Terminal';
import { useTerminalSession } from '../../features/terminal/useTerminalSession';

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

export function PodTerminalModal(props: PodTerminalModalProps) {
  // The shell choice outlives one opening: reopening offers the last one.
  const [shell, setShell] = useState('/bin/sh');
  const [attempt, setAttempt] = useState(0);

  // The dialog, and with it the exec session, exists only while the modal
  // is open: closing kills the session, reopening starts a fresh one.
  if (!props.isOpen) return null;
  return (
    <PodTerminalDialog
      {...props}
      shell={shell}
      onShellChange={setShell}
      attempt={attempt}
      onReconnect={() => setAttempt((k) => k + 1)}
    />
  );
}

interface PodTerminalDialogProps extends PodTerminalModalProps {
  shell: string;
  onShellChange: (shell: string) => void;
  attempt: number;
  onReconnect: () => void;
}

function PodTerminalDialog({
  onClose,
  podName,
  namespace,
  contextName,
  shell,
  onShellChange,
  attempt,
  onReconnect,
}: PodTerminalDialogProps) {
  // `transport` is `pty` when kubectl runs inside a pseudo-terminal (the
  // container shell then has a TTY) and `pipe` without node-pty.
  const { sessionId, transport, windowsPty, loading, error } =
    useTerminalSession(
      { kind: 'pod-exec', podName, namespace, contextName, shell },
      attempt
    );

  return (
    <BaseModal
      isOpen
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
            aria-label="Shell"
            value={shell}
            onChange={(e) => onShellChange(e.target.value)}
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
              onClick={onReconnect}
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
            <Terminal
              sessionId={sessionId}
              kind="pod-exec"
              transport={transport}
              windowsPty={windowsPty}
            />
          )}
        </div>
      </div>
    </BaseModal>
  );
}
