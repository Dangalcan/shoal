import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { app, ipcMain } from 'electron';
import { spawn } from 'child_process';
import { registerTerminalIpcHandlers } from '../ipc/terminal-ipc';
import {
  resolveLocalShell,
  getTerminalCwd,
} from '../services/terminal/local-shells';
import { loadNodePty } from '../services/terminal/node-pty-loader';
import type { NodePty } from '../services/terminal/node-pty-loader';

vi.mock('../logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('electron', () => ({
  app: { on: vi.fn() },
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Stub the two functions the modules under test pull from child_process:
// terminal-ipc uses spawn; safe-exec (via ipc-utils) promisifies execFile.
vi.mock('child_process', () => {
  const spawn = vi.fn();
  const execFile = vi.fn();
  return { spawn, execFile, default: { spawn, execFile } };
});

// node-pty is absent unless a test says otherwise, so local sessions take
// the pipe path (the fallback, and what every session was before node-pty).
vi.mock('../services/terminal/node-pty-loader', () => ({
  loadNodePty: vi.fn(() => null),
}));

vi.mock('../services/terminal/local-shells', () => ({
  getLocalShells: vi.fn(() => [
    { id: 'powershell', label: 'PowerShell', family: 'windows' },
    { id: 'cmd', label: 'Command Prompt', family: 'windows' },
  ]),
  getDefaultShellId: vi.fn(() => 'powershell'),
  resolveLocalShell: vi.fn((id?: string) => {
    if (id && id !== 'powershell' && id !== 'cmd') {
      throw new Error(`Unknown or unavailable shell: ${id}`);
    }
    return id === 'cmd'
      ? {
          id: 'cmd',
          label: 'Command Prompt',
          family: 'windows',
          file: 'cmd.exe',
          args: [],
        }
      : {
          id: 'powershell',
          label: 'PowerShell',
          family: 'windows',
          file: 'powershell.exe',
          args: ['-NoLogo'],
        };
  }),
  getTerminalCwd: vi.fn(() => '/tmp/shoal-terminal'),
}));

type IpcHandler = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

function makeFakeChild() {
  return {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    stdin: { write: vi.fn(), on: vi.fn(), destroyed: false },
    on: vi.fn(),
    kill: vi.fn(),
    pid: 1234,
  };
}

function makeFakePty() {
  return {
    pid: 4321,
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  };
}

/** Makes node-pty "available" with a spawn that returns `pty`. */
function installFakeNodePty(pty: ReturnType<typeof makeFakePty>) {
  const ptySpawn = vi.fn(() => pty);
  vi.mocked(loadNodePty).mockReturnValue({
    spawn: ptySpawn,
  } as unknown as NodePty);
  return ptySpawn;
}

const mockEvent = {
  sender: {
    isDestroyed: vi.fn(() => false),
    send: vi.fn(),
  },
} as unknown as IpcMainInvokeEvent;

function getHandler(channel: string): IpcHandler {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as IpcHandler;
}

describe('terminal-ipc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps mockReturnValue overrides from earlier tests.
    vi.mocked(mockEvent.sender.isDestroyed).mockReturnValue(false);
    vi.mocked(loadNodePty).mockReturnValue(null);
    vi.mocked(spawn).mockReturnValue(
      makeFakeChild() as unknown as ReturnType<typeof spawn>
    );
    registerTerminalIpcHandlers();
  });

  describe('terminal:create (local)', () => {
    it('spawns the default shell in the temp cwd', async () => {
      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'local',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('sessionId');
      expect(resolveLocalShell).toHaveBeenCalledWith(undefined);
      expect(getTerminalCwd).toHaveBeenCalled();
      expect(spawn).toHaveBeenCalledWith(
        'powershell.exe',
        ['-NoLogo'],
        expect.objectContaining({ cwd: '/tmp/shoal-terminal' })
      );
    });

    it('spawns the requested shell from the allowlist', async () => {
      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'local',
        shell: 'cmd',
      });

      expect(result.success).toBe(true);
      expect(resolveLocalShell).toHaveBeenCalledWith('cmd');
      expect(spawn).toHaveBeenCalledWith(
        'cmd.exe',
        [],
        expect.objectContaining({ cwd: '/tmp/shoal-terminal' })
      );
    });

    it('rejects shells outside the allowlist without spawning', async () => {
      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'local',
        shell: 'C:\\evil.exe',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Unknown or unavailable shell/);
      expect(spawn).not.toHaveBeenCalled();
    });

    it('reports the pipe transport when node-pty is not available', async () => {
      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'local',
      });

      expect(result.data).toMatchObject({ transport: 'pipe' });
    });
  });

  describe('terminal:create (local, pseudo-terminal)', () => {
    it('runs the shell in a pseudo-terminal when node-pty loads', async () => {
      const ptySpawn = installFakeNodePty(makeFakePty());

      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'local',
        shell: 'cmd',
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        shellFamily: 'windows',
        transport: 'pty',
      });
      // xterm's windowsPty option: present on Windows, absent elsewhere.
      expect((result.data as { windowsPty?: unknown }).windowsPty).toEqual(
        process.platform === 'win32'
          ? { backend: 'conpty', buildNumber: expect.any(Number) }
          : undefined
      );
      expect(resolveLocalShell).toHaveBeenCalledWith('cmd');
      expect(ptySpawn).toHaveBeenCalledWith(
        'cmd.exe',
        [],
        expect.objectContaining({
          cwd: '/tmp/shoal-terminal',
          cols: 80,
          rows: 24,
          name: 'xterm-256color',
        })
      );
      expect(spawn).not.toHaveBeenCalled();
    });

    it('passes the size the renderer sends to the pty', async () => {
      const ptySpawn = installFakeNodePty(makeFakePty());

      await getHandler('terminal:create')(mockEvent, {
        kind: 'local',
        cols: 132,
        rows: 43,
      });

      expect(ptySpawn).toHaveBeenCalledWith(
        'powershell.exe',
        ['-NoLogo'],
        expect.objectContaining({ cols: 132, rows: 43 })
      );
    });

    it('rejects an invalid size without spawning anything', async () => {
      const ptySpawn = installFakeNodePty(makeFakePty());

      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'local',
        cols: 0,
        rows: 24,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid terminal cols: 0/);
      expect(ptySpawn).not.toHaveBeenCalled();
      expect(spawn).not.toHaveBeenCalled();
    });

    it('keeps pod-exec on pipes even when node-pty loads', async () => {
      const ptySpawn = installFakeNodePty(makeFakePty());

      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'pod-exec',
        podName: 'web',
        namespace: 'default',
        contextName: 'kind-dev',
      });

      expect(result.data).toMatchObject({ transport: 'pipe' });
      expect(ptySpawn).not.toHaveBeenCalled();
      expect(spawn).toHaveBeenCalledWith(
        'kubectl',
        expect.arrayContaining(['exec', '-i', 'web']),
        expect.anything()
      );
    });

    it('falls back to pipes when the pty spawn fails', async () => {
      vi.mocked(loadNodePty).mockReturnValue({
        spawn: vi.fn(() => {
          throw new Error('CreatePseudoConsole failed');
        }),
      } as unknown as NodePty);

      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'local',
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ transport: 'pipe' });
      expect(spawn).toHaveBeenCalledWith(
        'powershell.exe',
        ['-NoLogo'],
        expect.objectContaining({ cwd: '/tmp/shoal-terminal' })
      );
    });

    it('forwards pty output and exit to the renderer', async () => {
      const pty = makeFakePty();
      installFakeNodePty(pty);

      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'local',
      });
      const { sessionId } = result.data as { sessionId: string };
      const onData = pty.onData.mock.calls[0][0] as (data: string) => void;
      const onExit = pty.onExit.mock.calls[0][0] as () => void;

      onData('PS C:\\> ');
      onExit();

      expect(mockEvent.sender.send).toHaveBeenNthCalledWith(
        1,
        'terminal:output',
        { sessionId, data: 'PS C:\\> ' }
      );
      expect(mockEvent.sender.send).toHaveBeenLastCalledWith(
        'terminal:exited',
        { sessionId }
      );
      await expect(
        getHandler('terminal:input')(mockEvent, { sessionId, data: 'x' })
      ).resolves.toMatchObject({ success: false });
    });

    it('writes input, resizes the pty and sends Ctrl+C as a byte', async () => {
      const pty = makeFakePty();
      installFakeNodePty(pty);

      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'local',
      });
      const { sessionId } = result.data as { sessionId: string };

      await expect(
        getHandler('terminal:input')(mockEvent, { sessionId, data: 'ls\r' })
      ).resolves.toMatchObject({ success: true });
      expect(pty.write).toHaveBeenCalledWith('ls\r');

      await expect(
        getHandler('terminal:resize')(mockEvent, {
          sessionId,
          cols: 120,
          rows: 40,
        })
      ).resolves.toMatchObject({ success: true });
      expect(pty.resize).toHaveBeenCalledWith(120, 40);

      await expect(
        getHandler('terminal:resize')(mockEvent, {
          sessionId,
          cols: 120,
          rows: 1.5,
        })
      ).resolves.toMatchObject({
        success: false,
        error: 'Invalid terminal rows: 1.5',
      });

      // The pty delivers the interrupt itself: no process-tree killing.
      await expect(
        getHandler('terminal:interrupt')(mockEvent, { sessionId })
      ).resolves.toMatchObject({ success: true });
      expect(pty.write).toHaveBeenLastCalledWith('\x03');
      expect(spawn).not.toHaveBeenCalled();

      await expect(
        getHandler('terminal:kill')(mockEvent, { sessionId })
      ).resolves.toMatchObject({ success: true });
      expect(pty.kill).toHaveBeenCalledTimes(1);
      await expect(
        getHandler('terminal:input')(mockEvent, { sessionId, data: 'x' })
      ).resolves.toMatchObject({ success: false });
    });

    it('kills pty sessions when the app quits', async () => {
      const pty = makeFakePty();
      installFakeNodePty(pty);
      await getHandler('terminal:create')(mockEvent, { kind: 'local' });
      const quit = (
        vi.mocked(app.on).mock.calls as unknown as [string, () => void][]
      ).find(([event]) => event === 'will-quit')?.[1];

      quit?.();

      expect(pty.kill).toHaveBeenCalledTimes(1);
    });
  });

  describe('terminal:create (pod-exec)', () => {
    it('spawns kubectl directly (no cmd.exe) without a temp cwd', async () => {
      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'pod-exec',
        podName: 'my-pod',
        namespace: 'default',
        contextName: 'kind-test',
      });

      expect(result.success).toBe(true);
      expect(getTerminalCwd).not.toHaveBeenCalled();
      expect(spawn).toHaveBeenCalledWith(
        'kubectl',
        [
          'exec',
          '-i',
          'my-pod',
          '-n',
          'default',
          '--context',
          'kind-test',
          '--',
          '/bin/sh',
          '-i',
        ],
        expect.objectContaining({ cwd: undefined })
      );
    });

    it('passes an allowlisted shell through to kubectl', async () => {
      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'pod-exec',
        podName: 'my-pod',
        namespace: 'default',
        contextName: 'kind-test',
        shell: '/bin/bash',
      });

      expect(result.success).toBe(true);
      expect(spawn).toHaveBeenCalledWith(
        'kubectl',
        expect.arrayContaining(['--', '/bin/bash', '-i']),
        expect.anything()
      );
    });

    it('rejects a shell with metacharacters without spawning', async () => {
      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'pod-exec',
        podName: 'my-pod',
        namespace: 'default',
        contextName: 'kind-test',
        shell: 'sh&calc.exe',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid pod shell/);
      expect(spawn).not.toHaveBeenCalled();
    });

    it('rejects a shell outside the allowlist without spawning', async () => {
      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'pod-exec',
        podName: 'my-pod',
        namespace: 'default',
        contextName: 'kind-test',
        shell: '/usr/bin/python3',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid pod shell/);
      expect(spawn).not.toHaveBeenCalled();
    });

    it('fails when pod-exec args are missing', async () => {
      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'pod-exec',
        podName: 'my-pod',
      });

      expect(result.success).toBe(false);
      expect(spawn).not.toHaveBeenCalled();
    });
  });

  describe('terminal:shells', () => {
    it('returns the detected shells and the default id', async () => {
      const result = await getHandler('terminal:shells')(mockEvent);

      expect(result).toEqual({
        success: true,
        data: {
          shells: [
            { id: 'powershell', label: 'PowerShell', family: 'windows' },
            { id: 'cmd', label: 'Command Prompt', family: 'windows' },
          ],
          defaultShell: 'powershell',
        },
      });
    });
  });

  describe('session lifecycle', () => {
    it('forwards stdout and stderr, then reports a process exit', async () => {
      const child = makeFakeChild();
      vi.mocked(spawn).mockReturnValue(
        child as unknown as ReturnType<typeof spawn>
      );

      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'local',
      });
      const sessionId = (result.data as { sessionId: string }).sessionId;

      const stdoutListener = child.stdout.on.mock.calls[0][1] as (
        data: Buffer
      ) => void;
      const stderrListener = child.stderr.on.mock.calls[0][1] as (
        data: Buffer
      ) => void;
      const exitListener = child.on.mock.calls[0][1] as () => void;

      stdoutListener(Buffer.from('standard output'));
      stderrListener(Buffer.from('standard error'));
      exitListener();

      expect(mockEvent.sender.send).toHaveBeenNthCalledWith(
        1,
        'terminal:output',
        { sessionId, data: 'standard output' }
      );
      expect(mockEvent.sender.send).toHaveBeenNthCalledWith(
        2,
        'terminal:output',
        { sessionId, data: 'standard error' }
      );
      expect(mockEvent.sender.send).toHaveBeenLastCalledWith(
        'terminal:exited',
        { sessionId }
      );

      const inputResult = await getHandler('terminal:input')(mockEvent, {
        sessionId,
        data: 'echo after exit',
      });
      expect(inputResult).toMatchObject({ success: false });
    });

    it('does not send output or exit events to a destroyed renderer', async () => {
      const child = makeFakeChild();
      vi.mocked(spawn).mockReturnValue(
        child as unknown as ReturnType<typeof spawn>
      );
      vi.mocked(mockEvent.sender.isDestroyed).mockReturnValue(true);

      await getHandler('terminal:create')(mockEvent, { kind: 'local' });
      const stdoutListener = child.stdout.on.mock.calls[0][1] as (
        data: Buffer
      ) => void;
      const exitListener = child.on.mock.calls[0][1] as () => void;

      stdoutListener(Buffer.from('ignored'));
      exitListener();

      expect(mockEvent.sender.send).not.toHaveBeenCalled();
    });

    it('writes input, validates resize, kills sessions, and interrupts child processes', async () => {
      const child = makeFakeChild();
      vi.mocked(spawn).mockReturnValue(
        child as unknown as ReturnType<typeof spawn>
      );

      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'local',
      });
      const sessionId = (result.data as { sessionId: string }).sessionId;

      await expect(
        getHandler('terminal:input')(mockEvent, { sessionId, data: 'ls\n' })
      ).resolves.toMatchObject({ success: true });
      expect(child.stdin.write).toHaveBeenCalledWith('ls\n');

      await expect(
        getHandler('terminal:resize')(mockEvent, {
          sessionId,
          cols: 120,
          rows: 40,
        })
      ).resolves.toMatchObject({ success: true });
      await expect(
        getHandler('terminal:interrupt')(mockEvent, { sessionId })
      ).resolves.toMatchObject({ success: true });
      if (process.platform === 'win32') {
        expect(spawn).toHaveBeenLastCalledWith(
          'powershell.exe',
          expect.any(Array),
          expect.objectContaining({ windowsHide: true, stdio: 'ignore' })
        );
        // Kill by id (piping Win32_Process into Stop-Process binds by Name
        // and matches nothing), spare the console host (killing it takes the
        // shell down), and take each child's whole tree.
        const command = vi.mocked(spawn).mock.lastCall?.[1]?.at(-1) as string;
        expect(command).toContain('ParentProcessId=1234');
        expect(command).toContain("$_.Name -ne 'conhost.exe'");
        expect(command).toContain('taskkill /T /F /PID $_.ProcessId');
        expect(command).not.toContain('Stop-Process');
      } else {
        expect(child.kill).toHaveBeenCalledWith('SIGINT');
      }

      await expect(
        getHandler('terminal:kill')(mockEvent, { sessionId })
      ).resolves.toMatchObject({ success: true });
      expect(child.kill).toHaveBeenCalledTimes(
        process.platform === 'win32' ? 1 : 2
      );

      await expect(
        getHandler('terminal:resize')(mockEvent, {
          sessionId: 'missing',
          cols: 80,
          rows: 24,
        })
      ).resolves.toMatchObject({ success: false });
      await expect(
        getHandler('terminal:input')(mockEvent, {
          sessionId: 'missing',
          data: 'x',
        })
      ).resolves.toMatchObject({ success: false });
      await expect(
        getHandler('terminal:kill')(mockEvent, { sessionId: 'missing' })
      ).resolves.toMatchObject({ success: true });
    });
  });

  describe('session lifecycle', () => {
    const originalPlatform = process.platform;
    const setPlatform = (value: string) =>
      Object.defineProperty(process, 'platform', { value, configurable: true });
    afterEach(() => setPlatform(originalPlatform));

    const listener = (child: ReturnType<typeof makeFakeChild>, name: string) =>
      child.on.mock.calls.find(([event]) => event === name)?.[1] as
        ((...args: unknown[]) => void) | undefined;

    it('tells the renderer which line endings the shell uses', async () => {
      const local = await getHandler('terminal:create')(mockEvent, {
        kind: 'local',
      });
      const pod = await getHandler('terminal:create')(mockEvent, {
        kind: 'pod-exec',
        podName: 'web',
        namespace: 'default',
        contextName: 'kind-dev',
      });

      expect(local.data).toMatchObject({ shellFamily: 'windows' });
      expect(pod.data).toMatchObject({ shellFamily: 'unix' });
    });

    it('reports a shell that fails to start and ends the session', async () => {
      const child = makeFakeChild();
      vi.mocked(spawn).mockReturnValue(
        child as unknown as ReturnType<typeof spawn>
      );
      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'local',
      });
      const { sessionId } = result.data as { sessionId: string };

      listener(child, 'error')?.(new Error('spawn powershell.exe ENOENT'));

      const sent = vi.mocked(mockEvent.sender.send).mock.calls;
      expect(sent).toContainEqual([
        'terminal:output',
        expect.objectContaining({
          sessionId,
          data: expect.stringContaining('Could not start powershell.exe'),
        }),
      ]);
      expect(sent).toContainEqual(['terminal:exited', { sessionId }]);
      await expect(
        getHandler('terminal:input')(mockEvent, { sessionId, data: 'x' })
      ).resolves.toMatchObject({ success: false });
    });

    it('refuses input once the shell stdin is gone', async () => {
      const child = makeFakeChild();
      vi.mocked(spawn).mockReturnValue(
        child as unknown as ReturnType<typeof spawn>
      );
      const { sessionId } = (
        await getHandler('terminal:create')(mockEvent, { kind: 'local' })
      ).data as { sessionId: string };
      child.stdin.destroyed = true;

      const result = await getHandler('terminal:input')(mockEvent, {
        sessionId,
        data: 'ls\n',
      });

      expect(result).toMatchObject({
        success: false,
        error: 'Terminal session is closed',
      });
      expect(child.stdin.write).not.toHaveBeenCalled();
    });

    it('interrupts the shell children on Linux, not only the shell', async () => {
      setPlatform('linux');
      const child = makeFakeChild();
      vi.mocked(spawn).mockReturnValue(
        child as unknown as ReturnType<typeof spawn>
      );
      const { sessionId } = (
        await getHandler('terminal:create')(mockEvent, { kind: 'local' })
      ).data as { sessionId: string };
      vi.mocked(spawn).mockReturnValue({
        on: vi.fn(),
      } as unknown as ReturnType<typeof spawn>);

      await getHandler('terminal:interrupt')(mockEvent, { sessionId });

      expect(spawn).toHaveBeenLastCalledWith(
        'pkill',
        ['-INT', '-P', '1234'],
        expect.objectContaining({ stdio: 'ignore' })
      );
      expect(child.kill).toHaveBeenCalledWith('SIGINT');
    });

    it('kills every open shell when the app quits', async () => {
      const child = makeFakeChild();
      vi.mocked(spawn).mockReturnValue(
        child as unknown as ReturnType<typeof spawn>
      );
      await getHandler('terminal:create')(mockEvent, { kind: 'local' });
      const quit = (
        vi.mocked(app.on).mock.calls as unknown as [string, () => void][]
      ).find(([event]) => event === 'will-quit')?.[1];

      quit?.();

      expect(child.kill).toHaveBeenCalled();
    });
  });
});
