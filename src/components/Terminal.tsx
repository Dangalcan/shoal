import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

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
  className?: string;
}

export function Terminal({
  sessionId,
  kind,
  shellFamily,
  className = '',
}: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const fit = useCallback(() => {
    if (!fitAddonRef.current || !xtermRef.current) return;
    try {
      fitAddonRef.current.fit();
      const { cols, rows } = xtermRef.current;
      window.electron.terminalResize(sessionId, cols, rows);
    } catch {
      // ignore fit errors during mount/unmount race
    }
  }, [sessionId]);

  useEffect(() => {
    if (!containerRef.current) return;
    const isLocal = kind === 'local';
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
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Local unix shells (WSL, Git Bash without stderr prompt) print nothing
    // until the first command — without this the terminal looks dead.
    if (isLocal && !isWindowsShell) {
      terminal.write(
        '\x1b[90m[Shell ready — no PTY prompt; type a command and press Enter]\x1b[0m\r\n'
      );
    }

    // Both local and pod-exec: buffer input locally and echo to screen.
    // - cmd.exe (local): never echoes piped input, so we must echo.
    // - pod shell (pod-exec): no real PTY, so the shell won't echo char-by-char.
    //   The shell may echo the full line back on Enter, causing a slight
    //   double-display of the command — unavoidable without a real PTY.
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
          window.electron.terminalInput(sessionId, inputBuffer + eol);
          inputBuffer = '';
        } else if (code === 0x03) {
          inputBuffer = '';
          terminal.write('^C\r\n');
          window.electron.terminalInterrupt(sessionId);
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

    const cleanupOutput = window.electron.onTerminalOutput(
      (sid: string, data: string) => {
        if (sid !== sessionId) return;
        // xterm needs \r\n to return to column 0. Unix shells output bare
        // \n, and so do native commands under a Windows shell (kubectl
        // writes \n even though PowerShell itself prints \r\n), so every
        // bare line feed becomes \r\n; a \r\n already there stays as it is.
        terminal.write(data.replace(/\r?\n/g, '\r\n'));
      }
    );

    const cleanupExit = window.electron.onTerminalExited((sid: string) => {
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
  }, [sessionId, kind, shellFamily, fit]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    />
  );
}
