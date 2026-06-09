import { ipcMain } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import {
  wrapIpcHandler,
  assertContext,
  assertNamespace,
  assertResourceName,
} from './ipc-utils';
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

interface Session {
  process: ChildProcess;
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

        if (kind === 'local') {
          file = 'powershell.exe';
          spawnArgs = ['-NoLogo'];
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

          // Route through cmd.exe so kubectl is found in the user's PATH
          const shell = args.shell || '/bin/sh';
          file = 'cmd.exe';
          spawnArgs = [
            '/c',
            'kubectl',
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
        });

        sessions.set(sessionId, { process: child });

        child.stdout!.on('data', (data: Buffer) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('terminal:output', {
              sessionId,
              data: data.toString('utf8'),
            });
          }
        });

        child.stderr!.on('data', (data: Buffer) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('terminal:output', {
              sessionId,
              data: data.toString('utf8'),
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

        log.info(`[Terminal] Created session ${sessionId} (${kind})`);
        return { sessionId };
      }
    )
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
        session.process.stdin!.write(data);
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
          // Kill child processes of the shell (e.g. ping.exe inside PowerShell)
          // but leave the shell itself alive so the terminal stays usable.
          spawn(
            'powershell.exe',
            [
              '-NoProfile',
              '-NonInteractive',
              '-Command',
              `Get-CimInstance Win32_Process -Filter "ParentProcessId=${pid}" | Stop-Process -Force -ErrorAction SilentlyContinue`,
            ],
            { windowsHide: true, stdio: 'ignore' }
          );
        } else {
          session.process.kill('SIGINT');
        }

        return true;
      }
    )
  );
}
