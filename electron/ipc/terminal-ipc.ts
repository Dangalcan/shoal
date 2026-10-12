import { app, ipcMain } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import {
  wrapIpcHandler,
  assertContext,
  assertNamespace,
  assertResourceName,
} from './ipc-utils';
import {
  getDefaultShellId,
  getLocalShells,
  getTerminalCwd,
  resolveLocalShell,
} from '../services/terminal/local-shells';
import log from '../logger';
import { StringDecoder } from 'string_decoder';

interface CreateTerminalArgs {
  kind: 'local' | 'pod-exec';
  podName?: string;
  namespace?: string;
  contextName?: string;
  shell?: string;
  cols?: number;
  rows?: number;
}

interface Session {
  process: ChildProcess;
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

const sessions = new Map<string, Session>();

export function registerTerminalIpcHandlers(): void {
  ipcMain.handle(
    'terminal:create',
    wrapIpcHandler(
      'terminal:create',
      async (event, args: CreateTerminalArgs) => {
        const { kind } = args;

        let file: string;
        let spawnArgs: string[];
        let cwd: string | undefined;
        // Line-ending family the renderer needs from the start: a local
        // PowerShell/cmd wants \r\n, Git Bash/WSL/pod shells want \n.
        let shellFamily: 'windows' | 'unix' = 'unix';

        if (kind === 'local') {
          // args.shell is a shell id validated against the detected
          // allowlist — never an arbitrary executable path.
          const localShell = resolveLocalShell(args.shell);
          file = localShell.file;
          spawnArgs = [...localShell.args];
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
          spawnArgs = [
            'exec',
            '-i',
            podName,
            '-n',
            namespace,
            '--context',
            contextName,
            '--',
            shell,
            '-i',
          ];
        }

        const sessionId = randomUUID();

        const child = spawn(file, spawnArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: process.env,
          windowsHide: true,
          cwd,
        });

        sessions.set(sessionId, { process: child });

        // A multibyte character can straddle two chunks; a StringDecoder
        // keeps the partial bytes until the next chunk completes them.
        const stdoutDecoder = new StringDecoder('utf8');
        const stderrDecoder = new StringDecoder('utf8');

        child.stdout!.on('data', (data: Buffer) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('terminal:output', {
              sessionId,
              data: stdoutDecoder.write(data),
            });
          }
        });

        child.stderr!.on('data', (data: Buffer) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('terminal:output', {
              sessionId,
              data: stderrDecoder.write(data),
            });
          }
        });

        child.on('exit', () => {
          sessions.delete(sessionId);
          if (!event.sender.isDestroyed()) {
            event.sender.send('terminal:exited', { sessionId });
          }
          log.info(`[Terminal] Session ${sessionId} exited`);
        });

        // A spawn that fails (binary gone, permissions) emits 'error', not
        // 'exit'. Without this listener the exception is uncaught in main
        // and the renderer waits forever for a prompt.
        child.on('error', (err: Error) => {
          log.error(
            `[Terminal] Session ${sessionId} could not start ${file}:`,
            err.message
          );
          sessions.delete(sessionId);
          if (!event.sender.isDestroyed()) {
            event.sender.send('terminal:output', {
              sessionId,
              data: `\r\nCould not start ${file}: ${err.message}\r\n`,
            });
            event.sender.send('terminal:exited', { sessionId });
          }
        });
        // Writing to a shell that just died raises EPIPE on its stdin.
        child.stdin?.on('error', (err: Error) => {
          log.warn(`[Terminal] Session ${sessionId} stdin:`, err.message);
        });

        log.info(`[Terminal] Created session ${sessionId} (${kind})`);
        return { sessionId, shellFamily };
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
        const stdin = session.process.stdin;
        if (!stdin || stdin.destroyed) {
          throw new Error('Terminal session is closed');
        }
        stdin.write(data);
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
        { sessionId }: { sessionId: string; cols: number; rows: number }
      ) => {
        // No-op: piped processes don't support PTY resize
        if (!sessions.has(sessionId))
          throw new Error(`No terminal session: ${sessionId}`);
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
          session.process.kill();
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
        if (!session || !session.process.pid)
          throw new Error(`No terminal session: ${sessionId}`);

        const pid = session.process.pid;

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
          // There is no PTY, so the shell's children are not in a
          // foreground process group that SIGINT would reach: signal them
          // directly (pkill is in procps on every desktop distro; if it is
          // missing the shell still gets its SIGINT below).
          spawn('pkill', ['-INT', '-P', String(pid)], { stdio: 'ignore' }).on(
            'error',
            () => undefined
          );
          session.process.kill('SIGINT');
        }

        return true;
      }
    )
  );

  // Shells are plain child processes: without this they outlive the app.
  app.on('will-quit', () => {
    for (const [sessionId, session] of sessions) {
      session.process.kill();
      sessions.delete(sessionId);
    }
  });
}
