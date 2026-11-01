import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { StringDecoder } from 'string_decoder';
import log from '../../logger';
import type {
  TerminalSession,
  TerminalSessionEvents,
} from './terminal-session';

export interface PipeSessionOptions {
  /** Session id, for the log. */
  sessionId: string;
  file: string;
  args: string[];
  cwd?: string;
}

/**
 * A shell on plain pipes (child_process.spawn), without a pseudo-terminal:
 * the shell cannot be resized, does not echo and never sees Ctrl+C on its
 * input, so the renderer echoes keystrokes itself and `interrupt` signals
 * the shell's children directly. Local and pod-exec sessions run this way
 * when node-pty is not available (kubectl exec -i then carries the bytes
 * without a TTY in the container).
 */
export function spawnPipeSession(
  options: PipeSessionOptions,
  events: TerminalSessionEvents
): TerminalSession {
  const { sessionId, file, args, cwd } = options;

  const child = spawn(file, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
    windowsHide: true,
    cwd,
  });

  // A multibyte character can straddle two chunks; a StringDecoder
  // keeps the partial bytes until the next chunk completes them.
  const stdoutDecoder = new StringDecoder('utf8');
  const stderrDecoder = new StringDecoder('utf8');

  child.stdout!.on('data', (data: Buffer) => {
    events.onData(stdoutDecoder.write(data));
  });
  child.stderr!.on('data', (data: Buffer) => {
    events.onData(stderrDecoder.write(data));
  });

  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    events.onExit();
  };
  child.on('exit', end);

  // A spawn that fails (binary gone, permissions) emits 'error', not
  // 'exit'. Without this listener the exception is uncaught in main
  // and the renderer waits forever for a prompt.
  child.on('error', (err: Error) => {
    events.onError(`Could not start ${file}: ${err.message}`);
    end();
  });
  // Writing to a shell that just died raises EPIPE on its stdin.
  child.stdin?.on('error', (err: Error) => {
    log.warn(`[Terminal] Session ${sessionId} stdin:`, err.message);
  });

  return {
    transport: 'pipe',
    get pid() {
      return child.pid;
    },
    write(data) {
      const stdin = child.stdin;
      if (!stdin || stdin.destroyed) {
        throw new Error('Terminal session is closed');
      }
      stdin.write(data);
    },
    resize() {
      // Pipes have no window size.
    },
    interrupt() {
      interruptChildren(child);
    },
    kill() {
      child.kill();
    },
  };
}

/**
 * Ctrl+C for a shell without a pseudo-terminal. There is no foreground
 * process group that a SIGINT would reach, so the shell's children are
 * signalled directly and the shell itself stays open.
 */
function interruptChildren(child: ChildProcess): void {
  const pid = child.pid;
  if (!pid) return;

  if (process.platform === 'win32') {
    // Kill the process trees of the shell's children (e.g. ping.exe
    // inside PowerShell) but leave the shell itself alive so the
    // terminal stays usable. Two traps: piping Win32_Process straight
    // into Stop-Process binds by Name ("PING.EXE"), which matches no
    // process and silently does nothing, so kill by id; and the hidden
    // console host (conhost.exe) is a child too, and killing it takes
    // the shell down with it.
    spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Get-CimInstance Win32_Process -Filter "ParentProcessId=${pid}" | Where-Object { $_.Name -ne 'conhost.exe' } | ForEach-Object { taskkill /T /F /PID $_.ProcessId | Out-Null }`,
      ],
      { windowsHide: true, stdio: 'ignore' }
    );
  } else {
    // pkill is in procps on every desktop distro; if it is missing the
    // shell still gets its SIGINT below.
    spawn('pkill', ['-INT', '-P', String(pid)], { stdio: 'ignore' }).on(
      'error',
      () => undefined
    );
    child.kill('SIGINT');
  }
}
