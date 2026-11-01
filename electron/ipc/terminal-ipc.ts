import { app, ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import {
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

const sessions = new Map<string, TerminalSession>();

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
        const send = (channel: string, payload: object) => {
          if (!event.sender.isDestroyed()) event.sender.send(channel, payload);
        };
        const events: TerminalSessionEvents = {
          onData: (data) => send('terminal:output', { sessionId, data }),
          onExit: () => {
            sessions.delete(sessionId);
            send('terminal:exited', { sessionId });
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
        const session = sessions.get(sessionId);
        if (session) {
          session.kill();
          sessions.delete(sessionId);
          log.info(`[Terminal] Killed session ${sessionId}`);
        }
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
    for (const [sessionId, session] of sessions) {
      session.kill();
      sessions.delete(sessionId);
    }
  });
}
