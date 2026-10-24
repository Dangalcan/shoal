import os from 'os';
import type { IPty } from 'node-pty';
import log from '../../logger';
import { loadNodePty } from './node-pty-loader';
import type {
  TerminalSession,
  TerminalSessionEvents,
  TerminalWindowsPty,
} from './terminal-session';

/**
 * On Windows the pseudo-terminal is ConPTY, which repaints its own buffer
 * when the window is resized; xterm needs the backend and the Windows build
 * (os.release() is "10.0.22631") to leave the reflow to it.
 */
function windowsPtyInfo(): TerminalWindowsPty | undefined {
  if (process.platform !== 'win32') return undefined;
  const build = Number.parseInt(os.release().split('.')[2] ?? '', 10);
  return Number.isNaN(build)
    ? { backend: 'conpty' }
    : { backend: 'conpty', buildNumber: build };
}

export interface PtySessionOptions {
  /** Session id, for the log. */
  sessionId: string;
  file: string;
  args: string[];
  cwd: string;
  cols: number;
  rows: number;
}

/**
 * Spawns the shell inside a pseudo-terminal (node-pty). The shell gets a
 * real console: it prints its own prompt, echoes and edits the line, sees
 * Ctrl+C on its input, follows window resizes and can run full-screen
 * programs. Returns null, with the reason in the log, when node-pty is not
 * available on this machine or the spawn fails; the caller then falls
 * back to pipes.
 */
export function spawnPtySession(
  options: PtySessionOptions,
  events: TerminalSessionEvents
): TerminalSession | null {
  const pty = loadNodePty();
  if (!pty) return null;

  const { sessionId, file, args, cwd, cols, rows } = options;
  let term: IPty;
  try {
    term = pty.spawn(file, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: process.env,
      // Windows: the ConPTY that ships with node-pty rather than the one in
      // the OS. It is newer than Windows 10's, and it is the only mode
      // whose kill() does not fork a Node helper (conpty_console_list_agent)
      // to enumerate console processes; that fork cannot work in packaged
      // builds because the runAsNode fuse is off.
      useConptyDll: true,
    });
  } catch (err) {
    log.warn(
      `[Terminal] Session ${sessionId}: could not start ${file} in a pseudo-terminal, using pipes:`,
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }

  let open = true;
  term.onData((data) => events.onData(data));
  term.onExit(() => {
    open = false;
    events.onExit();
  });

  return {
    transport: 'pty',
    windowsPty: windowsPtyInfo(),
    get pid() {
      return term.pid;
    },
    write(data) {
      if (!open) throw new Error('Terminal session is closed');
      term.write(data);
    },
    resize(cols, rows) {
      if (open) term.resize(cols, rows);
    },
    interrupt() {
      // The pseudo-terminal turns the byte into SIGINT (CTRL_C_EVENT on
      // Windows) for the foreground program, as any terminal does.
      if (open) term.write('\x03');
    },
    kill() {
      if (open) term.kill();
    },
  };
}
