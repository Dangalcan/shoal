import { app, ipcMain } from 'electron';
import type { WebContents } from 'electron';
import { randomUUID } from 'crypto';
import {
  onRendererUnload,
  wrapIpcHandler,
  assertContext,
  assertNamespace,
  assertResourceName,
} from './ipc-utils';
import {
  findExecutable,
  getDefaultShellId,
  getLocalShells,
  getTerminalCwd,
  resolveLocalShell,
} from '../services/terminal/local-shells';
import { spawnPipeSession } from '../services/terminal/pipe-session';
import { spawnPtySession } from '../services/terminal/pty-session';
import type {
  TerminalSession,
  TerminalSessionEvents,
} from '../services/terminal/terminal-session';
import log from '../logger';

interface CreateTerminalArgs {
  kind: 'local' | 'pod-exec';
  podName?: string;
  namespace?: string;
  contextName?: string;
  shell?: string;
  cols?: number;
  rows?: number;
}

// Shells we agree to exec inside a pod. The renderer offers exactly these
// (PodTerminalModal SHELL_OPTIONS); anything else over IPC is rejected so a
// compromised renderer can't smuggle arbitrary strings into the spawn args.
const POD_EXEC_SHELLS = new Set([
  '/bin/sh',
  '/bin/bash',
  '/bin/ash',
  '/bin/zsh',
  'sh',
  'bash',
  'ash',
  'zsh',
]);

function assertPodShell(v: string): void {
  if (!POD_EXEC_SHELLS.has(v)) throw new Error(`Invalid pod shell: "${v}"`);
}

// Terminal sizes the renderer may send. xterm's fit addon produces small
// positive integers; anything else comes from a broken or hostile caller.
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const MAX_DIMENSION = 1000;

function assertDimension(value: unknown, name: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_DIMENSION
  ) {
    throw new Error(`Invalid terminal ${name}: ${String(value)}`);
  }
  return value;
}

// Flow control. The output a terminal has not drawn yet is counted, and past
// the high mark the shell is paused until the renderer catches up, so a program
// writing as fast as it can cannot outrun xterm's write buffer.
const FLOW_HIGH_MARK = 1024 * 1024;
const FLOW_LOW_MARK = 256 * 1024;

/** What a terminal may say before it listens; the newest text is kept. */
const MAX_UNATTACHED_OUTPUT = 1024 * 1024;

/** A session as the renderer sees it, which outlives the shell until attached. */
interface SessionOutlet {
  ownerId: number;
  /** Messages waiting for the renderer to subscribe; null once it has. */
  pending:
    { channel: string; payload: { sessionId: string; data?: string } }[] | null;
  pendingOutput: number;
  /** Output sent and not yet reported as drawn. */
  undrawn: number;
  paused: boolean;
}

const sessions = new Map<string, TerminalSession>();
const outlets = new Map<string, SessionOutlet>();

/** Windows whose reload, crash or close already ends their sessions. */
const watchedSenders = new WeakSet<WebContents>();

function endSession(sessionId: string): void {
  sessions.get(sessionId)?.kill();
  sessions.delete(sessionId);
  outlets.delete(sessionId);
}

function endSessionsOnUnload(sender: WebContents): void {
  if (watchedSenders.has(sender)) return;
  watchedSenders.add(sender);
  const ownerId = sender.id;
  onRendererUnload(sender, (why) => {
    let ended = 0;
    for (const [sessionId, outlet] of outlets) {
      if (outlet.ownerId !== ownerId) continue;
      endSession(sessionId);
      ended += 1;
    }
    if (ended > 0) log.info(`[Terminal] ${why}: ended ${ended} session(s)`);
  });
}

/** Holds a message for a renderer that has not subscribed yet. */
function holdForAttach(
  outlet: SessionOutlet,
  channel: string,
  payload: { sessionId: string; data?: string }
): void {
  const pending = outlet.pending!;
  pending.push({ channel, payload });
  outlet.pendingOutput += payload.data?.length ?? 0;
  while (outlet.pendingOutput > MAX_UNATTACHED_OUTPUT) {
    const oldest = pending.findIndex((message) => message.payload.data);
    const dropped = pending[oldest]?.payload.data?.length ?? 0;
    outlet.pendingOutput -= dropped;
    // It will never be drawn, so flow control must not wait for it.
    outlet.undrawn -= dropped;
    pending.splice(oldest, 1);
  }
}

export function registerTerminalIpcHandlers(): void {
  ipcMain.handle(
    'terminal:create',
    wrapIpcHandler(
      'terminal:create',
      async (event, args: CreateTerminalArgs) => {
        const { kind } = args;

        let file: string;
        // Program and arguments in a pseudo-terminal; they differ for
        // kubectl, which takes `-t` only when its stdin is a terminal and
        // which node-pty cannot find by its bare name on Windows.
        let ptyFile: string;
        let spawnArgs: string[];
        let ptyArgs: string[];
        let cwd: string | undefined;
        // Line-ending family the renderer needs from the start: a local
        // PowerShell/cmd wants \r\n, Git Bash/WSL/pod shells want \n.
        let shellFamily: 'windows' | 'unix' = 'unix';

        if (kind === 'local') {
          // args.shell is a shell id validated against the detected
          // allowlist — never an arbitrary executable path.
          const localShell = resolveLocalShell(args.shell);
          file = localShell.file;
          ptyFile = file;
          spawnArgs = [...localShell.args];
          ptyArgs = spawnArgs;
          cwd = getTerminalCwd();
          shellFamily = localShell.family;
        } else {
          const { podName, namespace, contextName } = args;
          if (!podName || !namespace || !contextName) {
            throw new Error(
              'pod-exec requires podName, namespace, and contextName'
            );
          }
          assertResourceName(podName);
          assertNamespace(namespace);
          assertContext(contextName);

          const shell = args.shell || '/bin/sh';
          assertPodShell(shell);

          // Spawn kubectl directly (PATH resolves kubectl.exe on Windows,
          // same as safe-exec). No cmd.exe: /c re-parses metacharacters,
          // which would turn renderer input into host command injection.
          file = 'kubectl';
          ptyFile = findExecutable(file) ?? file;
          const execArgs = [
            podName,
            '-n',
            namespace,
            '--context',
            contextName,
            '--',
            shell,
            '-i',
          ];
          spawnArgs = ['exec', '-i', ...execArgs];
          // `-t` gives the container shell a TTY and makes kubectl forward
          // the terminal size; kubectl refuses it unless its own stdin is a
          // terminal, so only the pseudo-terminal attempt carries it.
          ptyArgs = ['exec', '-it', ...execArgs];
        }

        const cols =
          args.cols === undefined
            ? DEFAULT_COLS
            : assertDimension(args.cols, 'cols');
        const rows =
          args.rows === undefined
            ? DEFAULT_ROWS
            : assertDimension(args.rows, 'rows');

        const sessionId = randomUUID();
        endSessionsOnUnload(event.sender);
        const outlet: SessionOutlet = {
          ownerId: event.sender.id,
          pending: [],
          pendingOutput: 0,
          undrawn: 0,
          paused: false,
        };
        outlets.set(sessionId, outlet);
        // The shell can say something, or fail, before the renderer has the
        // session id and subscribes: that waits for terminal:attach.
        const send = (
          channel: string,
          payload: { sessionId: string; data?: string }
        ) => {
          if (outlet.pending) holdForAttach(outlet, channel, payload);
          else if (!event.sender.isDestroyed()) {
            event.sender.send(channel, payload);
          }
        };
        const events: TerminalSessionEvents = {
          onData: (data) => {
            send('terminal:output', { sessionId, data });
            outlet.undrawn += data.length;
            if (!outlet.paused && outlet.undrawn > FLOW_HIGH_MARK) {
              outlet.paused = true;
              sessions.get(sessionId)?.pause();
            }
          },
          onExit: () => {
            sessions.delete(sessionId);
            send('terminal:exited', { sessionId });
            if (!outlet.pending) outlets.delete(sessionId);
            log.info(`[Terminal] Session ${sessionId} exited`);
          },
          onError: (message) => {
            log.error(`[Terminal] Session ${sessionId}: ${message}`);
            send('terminal:output', { sessionId, data: `\r\n${message}\r\n` });
          },
        };

        // Local shells, and kubectl for pod shells, get a pseudo-terminal
        // when node-pty is available; otherwise plain pipes. kubectl starts
        // in the same directory as a local shell (it does not care, but the
        // app directory is never a working directory).
        let session: TerminalSession | null = spawnPtySession(
          {
            sessionId,
            file: ptyFile,
            args: ptyArgs,
            cwd: cwd ?? getTerminalCwd(),
            cols,
            rows,
          },
          events
        );
        if (!session) {
          session = spawnPipeSession(
            { sessionId, file, args: spawnArgs, cwd },
            events
          );
        }
        sessions.set(sessionId, session);

        log.info(
          `[Terminal] Created session ${sessionId} (${kind}, ${session.transport})`
        );
        return {
          sessionId,
          shellFamily,
          transport: session.transport,
          windowsPty: session.windowsPty,
        };
      }
    )
  );

  // The renderer listens now: what the shell said meanwhile goes out, in order.
  ipcMain.handle(
    'terminal:attach',
    wrapIpcHandler(
      'terminal:attach',
      async (event, { sessionId }: { sessionId: string }) => {
        const outlet = outlets.get(sessionId);
        if (!outlet?.pending) return true;
        const pending = outlet.pending;
        outlet.pending = null;
        for (const { channel, payload } of pending) {
          if (!event.sender.isDestroyed()) event.sender.send(channel, payload);
        }
        if (!sessions.has(sessionId)) outlets.delete(sessionId);
        return true;
      }
    )
  );

  // The renderer has drawn this much more of the output.
  ipcMain.handle(
    'terminal:ack',
    wrapIpcHandler(
      'terminal:ack',
      async (
        _event,
        { sessionId, drawn }: { sessionId: string; drawn: number }
      ) => {
        const outlet = outlets.get(sessionId);
        if (!outlet || !Number.isFinite(drawn) || drawn <= 0) return true;
        outlet.undrawn = Math.max(0, outlet.undrawn - drawn);
        if (outlet.paused && outlet.undrawn < FLOW_LOW_MARK) {
          outlet.paused = false;
          sessions.get(sessionId)?.resume();
        }
        return true;
      }
    )
  );

  ipcMain.handle(
    'terminal:shells',
    wrapIpcHandler('terminal:shells', async () => ({
      shells: getLocalShells(),
      defaultShell: getDefaultShellId(),
    }))
  );

  ipcMain.handle(
    'terminal:input',
    wrapIpcHandler(
      'terminal:input',
      async (
        _event,
        { sessionId, data }: { sessionId: string; data: string }
      ) => {
        const session = sessions.get(sessionId);
        if (!session) throw new Error(`No terminal session: ${sessionId}`);
        session.write(data);
        return true;
      }
    )
  );

  ipcMain.handle(
    'terminal:resize',
    wrapIpcHandler(
      'terminal:resize',
      async (
        _event,
        {
          sessionId,
          cols,
          rows,
        }: { sessionId: string; cols: number; rows: number }
      ) => {
        const session = sessions.get(sessionId);
        if (!session) throw new Error(`No terminal session: ${sessionId}`);
        session.resize(
          assertDimension(cols, 'cols'),
          assertDimension(rows, 'rows')
        );
        return true;
      }
    )
  );

  ipcMain.handle(
    'terminal:kill',
    wrapIpcHandler(
      'terminal:kill',
      async (_event, { sessionId }: { sessionId: string }) => {
        const known = sessions.has(sessionId);
        endSession(sessionId);
        if (known) log.info(`[Terminal] Killed session ${sessionId}`);
        return true;
      }
    )
  );

  ipcMain.handle(
    'terminal:interrupt',
    wrapIpcHandler(
      'terminal:interrupt',
      async (_event, { sessionId }: { sessionId: string }) => {
        const session = sessions.get(sessionId);
        if (!session || session.pid === undefined)
          throw new Error(`No terminal session: ${sessionId}`);
        session.interrupt();
        return true;
      }
    )
  );

  // Shells are plain child processes: without this they outlive the app.
  app.on('will-quit', () => {
    for (const sessionId of [...sessions.keys()]) endSession(sessionId);
  });
}
