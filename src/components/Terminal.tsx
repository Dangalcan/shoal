import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type {
  ElectronAPI,
  TerminalTransport,
  TerminalWindowsPty,
} from '../types';
import { useApi } from '../services/api-context';

interface TerminalProps {
  sessionId: string;
  kind: 'local' | 'pod-exec';
  /**
   * Line-ending family of the shell. Local Windows shells (PowerShell,
   * cmd) need \r\n input and emit \r\n output; unix shells (Git Bash,
   * WSL, pod shells) need \n input and emit bare \n output.
   * Defaults: local → 'windows', pod-exec → 'unix'.
   */
  shellFamily?: 'windows' | 'unix';
  /**
   * What carries the session's bytes. `pty`: the shell runs in a
   * pseudo-terminal, so every keystroke goes to it as it is and the shell
   * echoes, edits the line, handles Ctrl+C and follows resizes. `pipe` (the
   * default, and always the case for pod-exec): no pseudo-terminal, so the
   * line is buffered and echoed here and Ctrl+C is emulated.
   */
  transport?: TerminalTransport;
  /**
   * For a `pty` session on Windows: the ConPTY backend and build, handed to
   * xterm so it leaves the reflow on resize to ConPTY.
   */
  windowsPty?: TerminalWindowsPty;
  className?: string;
}

/**
 * Input for a session without a pseudo-terminal: buffer the line, echo it
 * locally and send it on Enter.
 * - cmd.exe (local): never echoes piped input, so we must echo.
 * - pod shell (pod-exec): no real PTY, so the shell won't echo char-by-char.
 *   The shell may echo the full line back on Enter, causing a slight
 *   double-display of the command — unavoidable without a real PTY.
 * The input and interrupt calls are fire-and-forget: they only fail once
 * the session is gone, which onTerminalExited prints in the terminal, and
 * the main process logs the error.
 */
function attachPipeInput(
  terminal: XTerm,
  api: ElectronAPI,
  sessionId: string,
  isLocal: boolean,
  isWindowsShell: boolean
): void {
  let inputBuffer = '';
  terminal.onData((data: string) => {
    for (const ch of data) {
      const code = ch.charCodeAt(0);
      if (ch === '\r') {
        terminal.write('\r\n');
        if (isLocal) {
          const cmd = inputBuffer.trim().toLowerCase();
          if (cmd === 'clear' || cmd === 'cls') terminal.clear();
        }
        // Windows shells need \r\n; unix shells need just \n
        const eol = isWindowsShell ? '\r\n' : '\n';
        void api.terminalInput(sessionId, inputBuffer + eol);
        inputBuffer = '';
      } else if (code === 0x03) {
        inputBuffer = '';
        terminal.write('^C\r\n');
        void api.terminalInterrupt(sessionId);
      } else if (code === 0x7f || code === 0x08) {
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          terminal.write('\b \b');
        }
      } else if (code >= 0x20 && code < 0x7f) {
        inputBuffer += ch;
        terminal.write(ch);
      }
    }
  });
}

export function Terminal({
  sessionId,
  kind,
  shellFamily,
  transport = 'pipe',
  windowsPty,
  className = '',
}: TerminalProps) {
  const api = useApi();
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // The resize, input and interrupt calls are fire-and-forget: they only
  // fail once the session is gone, which onTerminalExited prints in the
  // terminal, and the main process logs the error.
  const fit = useCallback(() => {
    if (!fitAddonRef.current || !xtermRef.current) return;
    try {
      fitAddonRef.current.fit();
      const { cols, rows } = xtermRef.current;
      void api.terminalResize(sessionId, cols, rows);
    } catch {
      // ignore fit errors during mount/unmount race
    }
  }, [api, sessionId]);

  useEffect(() => {
    if (!containerRef.current) return;
    const isLocal = kind === 'local';
    const isPty = transport === 'pty';
    const isWindowsShell =
      (shellFamily ?? (isLocal ? 'windows' : 'unix')) === 'windows';

    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      // One stack for every platform: Windows, macOS and the common Linux
      // fonts, then the generic family. xterm needs a concrete value.
      fontFamily:
        'Consolas, "Cascadia Mono", Menlo, "DejaVu Sans Mono", "Liberation Mono", "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
      },
      windowsPty: isPty ? windowsPty : undefined,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    if (isPty) {
      // The pseudo-terminal echoes and edits the line itself; Ctrl+C,
      // backspace and `clear` are just bytes the shell understands.
      terminal.onData((data: string) => {
        void api.terminalInput(sessionId, data);
      });
    } else {
      // Local unix shells (WSL, Git Bash without stderr prompt) print
      // nothing until the first command — without this the terminal looks
      // dead.
      if (isLocal && !isWindowsShell) {
        terminal.write(
          '\x1b[90m[Shell ready — no PTY prompt; type a command and press Enter]\x1b[0m\r\n'
        );
      }
      attachPipeInput(terminal, api, sessionId, isLocal, isWindowsShell);
    }

    const cleanupOutput = api.onTerminalOutput((sid: string, data: string) => {
      if (sid !== sessionId) return;
      // A pseudo-terminal already emits \r\n, and full-screen programs
      // rely on a bare \n meaning "down one line, same column", so its
      // output goes through untouched. Pipes carry whatever the command
      // wrote: unix shells output bare \n, and so do native commands
      // under a Windows shell (kubectl writes \n even though PowerShell
      // itself prints \r\n), so there every bare line feed becomes \r\n
      // for xterm to return to column 0; a \r\n already there stays.
      terminal.write(isPty ? data : data.replace(/\r?\n/g, '\r\n'));
    });

    const cleanupExit = api.onTerminalExited((sid: string) => {
      if (sid === sessionId) {
        terminal.write('\r\n\x1b[31m[Process exited]\x1b[0m\r\n');
      }
    });

    const observer = new ResizeObserver(() => fit());
    observer.observe(containerRef.current!);

    return () => {
      cleanupOutput();
      cleanupExit();
      observer.disconnect();
      terminal.dispose();
    };
  }, [api, sessionId, kind, shellFamily, transport, windowsPty, fit]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    />
  );
}
