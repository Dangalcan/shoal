import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { app, ipcMain } from 'electron';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { registerTerminalIpcHandlers } from '../ipc/terminal-ipc';
import log from '../logger';
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
  // node-pty needs kubectl's full path (it does not add .exe to a bare
  // name on Windows); child_process.spawn resolves PATH itself.
  findExecutable: vi.fn((name: string) =>
    name === 'kubectl' ? 'C:/tools/kubectl.exe' : null
  ),
}));

type IpcHandler = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

function makeFakeChild() {
  return {
    stdout: { on: vi.fn(), pause: vi.fn(), resume: vi.fn() },
    stderr: { on: vi.fn(), pause: vi.fn(), resume: vi.fn() },
    stdin: { write: vi.fn(), on: vi.fn(), end: vi.fn(), destroyed: false },
    on: vi.fn(),
    kill: vi.fn(),
    pid: 1234,
  };
}

/** A child whose streams really emit, for tests of what it says when. */
function makeChild() {
  return Object.assign(new EventEmitter(), {
    stdout: Object.assign(new EventEmitter(), {
      pause: vi.fn(),
      resume: vi.fn(),
    }),
    stderr: Object.assign(new EventEmitter(), {
      pause: vi.fn(),
      resume: vi.fn(),
    }),
    stdin: Object.assign(new EventEmitter(), {
      write: vi.fn(),
      end: vi.fn(),
      destroyed: false,
    }),
    kill: vi.fn(),
    pid: 1234,
  });
}

function makeFakePty() {
  return {
    pid: 4321,
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
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
    id: 1,
    isDestroyed: vi.fn(() => false),
    send: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
  },
} as unknown as IpcMainInvokeEvent;

function getRawHandler(channel: string): IpcHandler {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as IpcHandler;
}

/**
 * The handler for a channel. terminal:create also attaches, as the renderer
 * does, so most tests see output as soon as it happens; the tests of the time
 * before attaching use getRawHandler.
 */
function getHandler(channel: string): IpcHandler {
  const handler = getRawHandler(channel);
  if (channel !== 'terminal:create') return handler;
  return (async (event: IpcMainInvokeEvent, args: unknown) => {
    const result = await (handler as (...a: unknown[]) => Promise<any>)(
      event,
      args
    );
    if (result.success) {
      await (getRawHandler('terminal:attach') as (...a: unknown[]) => unknown)(
        event,
        { sessionId: result.data.sessionId }
      );
    }
    return result;
  }) as unknown as IpcHandler;
}

describe('terminal-ipc: before the renderer attaches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockEvent.sender.isDestroyed).mockReturnValue(false);
    vi.mocked(loadNodePty).mockReturnValue(null);
    vi.mocked(spawn).mockReturnValue(makeChild() as never);
    registerTerminalIpcHandlers();
  });

  const create = async () => {
    const result = await (getRawHandler('terminal:create') as any)(mockEvent, {
      kind: 'local',
    });
    return result.data.sessionId as string;
  };
  const attach = (sessionId: string) =>
    (getRawHandler('terminal:attach') as any)(mockEvent, { sessionId });
  const child = () => vi.mocked(spawn).mock.results[0]!.value as any;

  it('holds what the shell says until then, and sends it in order', async () => {
    const sessionId = await create();

    child().stdout.emit('data', Buffer.from('one '));
    child().stderr.emit('data', Buffer.from('two'));
    expect(mockEvent.sender.send).not.toHaveBeenCalled();

    await attach(sessionId);
    expect(vi.mocked(mockEvent.sender.send).mock.calls).toEqual([
      ['terminal:output', { sessionId, data: 'one ' }],
      ['terminal:output', { sessionId, data: 'two' }],
    ]);

    child().stdout.emit('data', Buffer.from('three'));
    expect(mockEvent.sender.send).toHaveBeenLastCalledWith('terminal:output', {
      sessionId,
      data: 'three',
    });
  });

  it('still delivers a failure to start, which comes before the id is known', async () => {
    const sessionId = await create();

    child().emit('error', new Error('spawn kubectl ENOENT'));
    expect(mockEvent.sender.send).not.toHaveBeenCalled();

    await attach(sessionId);
    expect(vi.mocked(mockEvent.sender.send).mock.calls).toEqual([
      [
        'terminal:output',
        expect.objectContaining({
          sessionId,
          data: expect.stringContaining('spawn kubectl ENOENT'),
        }),
      ],
      ['terminal:exited', { sessionId }],
    ]);
  });

  it('keeps the newest output when a shell says too much meanwhile', async () => {
    const sessionId = await create();
    const chunk = 'x'.repeat(600 * 1024);

    child().stdout.emit('data', Buffer.from(`first${chunk}`));
    child().stdout.emit('data', Buffer.from(`second${chunk}`));
    await attach(sessionId);

    const sent = vi.mocked(mockEvent.sender.send).mock.calls;
    expect(sent).toHaveLength(1);
    expect((sent[0]![1] as { data: string }).data.startsWith('second')).toBe(
      true
    );
  });

  it('attaching twice, or to a session it never knew, sends nothing more', async () => {
    const sessionId = await create();
    child().stdout.emit('data', Buffer.from('once'));
    await attach(sessionId);
    await attach(sessionId);
    await attach('no-such-session');
    expect(mockEvent.sender.send).toHaveBeenCalledTimes(1);
  });

  it('drops the held output of a session killed before attaching', async () => {
    const sessionId = await create();
    child().stdout.emit('data', Buffer.from('never seen'));

    await (getRawHandler('terminal:kill') as any)(mockEvent, { sessionId });
    await attach(sessionId);

    expect(mockEvent.sender.send).not.toHaveBeenCalled();
  });

  it('does not send to a window closed before attaching', async () => {
    const sessionId = await create();
    child().stdout.emit('data', Buffer.from('never seen'));
    vi.mocked(mockEvent.sender.isDestroyed).mockReturnValue(true);

    await attach(sessionId);

    expect(mockEvent.sender.send).not.toHaveBeenCalled();
  });
});

describe('terminal-ipc: flow control', () => {
  const MB = 1024 * 1024;
  const pty = {
    pid: 1,
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockEvent.sender.isDestroyed).mockReturnValue(false);
    vi.mocked(loadNodePty).mockReturnValue({
      spawn: vi.fn(() => pty),
    } as unknown as NodePty);
    registerTerminalIpcHandlers();
  });

  const start = async () => {
    const result = (await getHandler('terminal:create')(mockEvent, {
      kind: 'local',
    })) as any;
    return {
      sessionId: result.data.sessionId as string,
      output: pty.onData.mock.calls[0]![0] as (data: string) => void,
    };
  };
  const ack = (sessionId: string, drawn: number) =>
    (getRawHandler('terminal:ack') as any)(mockEvent, { sessionId, drawn });

  it('pauses the shell past the high mark and resumes below the low mark', async () => {
    const { sessionId, output } = await start();

    output('x'.repeat(MB));
    expect(pty.pause).not.toHaveBeenCalled();
    output('x');
    expect(pty.pause).toHaveBeenCalledTimes(1);
    output('x');
    expect(pty.pause).toHaveBeenCalledTimes(1);

    await ack(sessionId, MB / 2);
    expect(pty.resume).not.toHaveBeenCalled();
    await ack(sessionId, MB / 2);
    expect(pty.resume).toHaveBeenCalledTimes(1);

    await ack(sessionId, MB);
    expect(pty.resume).toHaveBeenCalledTimes(1);
  });

  it('pauses both streams of a shell on pipes', async () => {
    vi.mocked(loadNodePty).mockReturnValue(null);
    vi.mocked(spawn).mockReturnValue(makeChild() as never);
    const result = (await getHandler('terminal:create')(mockEvent, {
      kind: 'local',
    })) as any;
    const child = vi.mocked(spawn).mock.results.at(-1)!.value as any;

    child.stdout.emit('data', Buffer.from('x'.repeat(MB + 1)));
    expect(child.stdout.pause).toHaveBeenCalledTimes(1);
    expect(child.stderr.pause).toHaveBeenCalledTimes(1);

    await ack(result.data.sessionId, MB + 1);
    expect(child.stdout.resume).toHaveBeenCalledTimes(1);
    expect(child.stderr.resume).toHaveBeenCalledTimes(1);
  });

  it('ignores a report that makes no sense, or for a session that is gone', async () => {
    const { sessionId, output } = await start();
    output('x'.repeat(MB + 1));

    await ack(sessionId, -5);
    await ack(sessionId, Number.NaN);
    await ack('no-such-session', MB);

    expect(pty.resume).not.toHaveBeenCalled();
  });
});

describe('terminal-ipc: when the renderer goes away', () => {
  const makeSender = (id: number) => ({
    id,
    isDestroyed: vi.fn(() => false),
    send: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
  });
  let sender: ReturnType<typeof makeSender>;
  let realPlatform: PropertyDescriptor;

  beforeEach(() => {
    vi.clearAllMocks();
    realPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;
    Object.defineProperty(process, 'platform', { value: 'linux' });
    vi.mocked(loadNodePty).mockReturnValue(null);
    vi.mocked(spawn).mockImplementation(() => makeChild() as never);
    registerTerminalIpcHandlers();
    sender = makeSender(7);
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', realPlatform);
    vi.mocked(spawn).mockReset();
  });

  const startSession = async (owner = sender) => {
    await getHandler('terminal:create')(
      { sender: owner } as unknown as IpcMainInvokeEvent,
      { kind: 'local' }
    );
    return vi.mocked(spawn).mock.results.at(-1)!.value as {
      kill: ReturnType<typeof vi.fn>;
    };
  };
  const onEvent = (name: string) =>
    [...sender.on.mock.calls, ...sender.once.mock.calls].find(
      ([registered]) => registered === name
    )![1] as (details?: object) => void;

  it('ends the sessions of that window on a reload, and only those', async () => {
    const mine = [await startSession(), await startSession()];
    const others = await startSession(makeSender(8));

    onEvent('did-start-navigation')({
      isMainFrame: true,
      isSameDocument: false,
    });

    for (const child of mine) expect(child.kill).toHaveBeenCalled();
    expect(others.kill).not.toHaveBeenCalled();
  });

  it.each(['render-process-gone', 'destroyed'])(
    'ends them on %s',
    async (name) => {
      const child = await startSession();
      onEvent(name)();
      expect(child.kill).toHaveBeenCalled();
    }
  );

  it('keeps them on a change of route or a navigation in a frame', async () => {
    const child = await startSession();
    const navigated = onEvent('did-start-navigation');

    navigated({ isMainFrame: true, isSameDocument: true });
    navigated({ isMainFrame: false, isSameDocument: false });

    expect(child.kill).not.toHaveBeenCalled();
  });

  it('watches a window once, however many sessions it opens', async () => {
    await startSession();
    await startSession();
    const watching = sender.on.mock.calls.filter(
      ([name]) => name === 'did-start-navigation'
    );
    expect(watching).toHaveLength(1);
  });
});

describe('terminal-ipc: ending a shell on pipes', () => {
  let realPlatform: PropertyDescriptor;
  const setPlatform = (value: string) =>
    Object.defineProperty(process, 'platform', { value });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    realPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;
    vi.mocked(loadNodePty).mockReturnValue(null);
    vi.mocked(spawn).mockImplementation(() => makeChild() as never);
    registerTerminalIpcHandlers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(process, 'platform', realPlatform);
    vi.mocked(spawn).mockReset();
  });

  const startAndKill = async () => {
    const result = (await getHandler('terminal:create')(mockEvent, {
      kind: 'local',
    })) as any;
    const child = vi.mocked(spawn).mock.results.at(-1)!.value as ReturnType<
      typeof makeChild
    >;
    await (getRawHandler('terminal:kill') as any)(mockEvent, {
      sessionId: result.data.sessionId,
    });
    return child;
  };

  it('closes stdin and sends SIGTERM, then SIGKILL to a shell that stays', async () => {
    setPlatform('linux');
    const child = await startAndKill();

    expect(child.stdin.end).toHaveBeenCalled();
    expect(child.kill).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2_000);
    expect(child.kill).toHaveBeenLastCalledWith('SIGKILL');
  });

  it('does not force a shell that already left', async () => {
    setPlatform('linux');
    const child = await startAndKill();

    child.emit('exit');
    vi.advanceTimersByTime(2_000);

    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it('ends the whole process tree on Windows', async () => {
    setPlatform('win32');
    const child = await startAndKill();

    expect(spawn).toHaveBeenLastCalledWith(
      'taskkill',
      ['/PID', '1234', '/T', '/F'],
      expect.objectContaining({ windowsHide: true })
    );
    expect(child.kill).not.toHaveBeenCalled();
  });

  it('falls back to kill() when taskkill cannot run', async () => {
    setPlatform('win32');
    const child = await startAndKill();

    const taskkill = vi.mocked(spawn).mock.results.at(-1)!
      .value as EventEmitter;
    taskkill.emit('error', new Error('no taskkill'));

    expect(child.kill).toHaveBeenCalledTimes(1);
  });
});

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

    it('runs kubectl exec with a TTY in a pseudo-terminal when node-pty loads', async () => {
      const ptySpawn = installFakeNodePty(makeFakePty());

      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'pod-exec',
        podName: 'web',
        namespace: 'default',
        contextName: 'kind-dev',
        cols: 120,
        rows: 40,
      });

      expect(result.data).toMatchObject({
        transport: 'pty',
        shellFamily: 'unix',
      });
      expect(spawn).not.toHaveBeenCalled();
      expect(ptySpawn).toHaveBeenCalledWith(
        'C:/tools/kubectl.exe',
        [
          'exec',
          '-it',
          'web',
          '-n',
          'default',
          '--context',
          'kind-dev',
          '--',
          '/bin/sh',
          '-i',
        ],
        expect.objectContaining({
          cols: 120,
          rows: 40,
          cwd: '/tmp/shoal-terminal',
        })
      );
    });

    it('falls back to kubectl exec -i on pipes when the pod pty spawn fails', async () => {
      vi.mocked(loadNodePty).mockReturnValue({
        spawn: vi.fn(() => {
          throw new Error('CreatePseudoConsole failed');
        }),
      } as unknown as NodePty);

      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'pod-exec',
        podName: 'web',
        namespace: 'default',
        contextName: 'kind-dev',
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ transport: 'pipe' });
      const [file, args] = vi.mocked(spawn).mock.calls[0]!;
      expect(file).toBe('kubectl');
      // kubectl refuses -t without a terminal on its stdin.
      expect(args).toEqual(expect.arrayContaining(['exec', '-i', 'web']));
      expect(args).not.toContain('-it');
      expect(args).not.toContain('-t');
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
    it('spawns kubectl directly (no cmd.exe) on pipes without a cwd', async () => {
      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'pod-exec',
        podName: 'my-pod',
        namespace: 'default',
        contextName: 'kind-test',
      });

      expect(result.success).toBe(true);
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
        process.platform === 'win32' ? 0 : 2
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

    it('keeps stderr and start failures away from a destroyed renderer', async () => {
      const child = makeFakeChild();
      vi.mocked(spawn).mockReturnValue(
        child as unknown as ReturnType<typeof spawn>
      );
      const { sessionId } = (
        await getHandler('terminal:create')(mockEvent, { kind: 'local' })
      ).data as { sessionId: string };
      vi.mocked(mockEvent.sender.isDestroyed).mockReturnValue(true);

      const stderrListener = child.stderr.on.mock.calls[0][1] as (
        data: Buffer
      ) => void;
      stderrListener(Buffer.from('ignored'));
      listener(child, 'error')?.(new Error('spawn powershell.exe EACCES'));

      expect(mockEvent.sender.send).not.toHaveBeenCalled();
      // The failed session is gone even though nobody was told.
      await expect(
        getHandler('terminal:input')(mockEvent, { sessionId, data: 'x' })
      ).resolves.toMatchObject({ success: false });
    });

    it('logs an EPIPE on the shell stdin instead of crashing', async () => {
      const child = makeFakeChild();
      vi.mocked(spawn).mockReturnValue(
        child as unknown as ReturnType<typeof spawn>
      );
      await getHandler('terminal:create')(mockEvent, { kind: 'local' });

      const [event, onStdinError] = child.stdin.on.mock.calls[0] as [
        string,
        (err: Error) => void,
      ];
      expect(event).toBe('error');
      expect(() => onStdinError(new Error('write EPIPE'))).not.toThrow();
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('stdin:'),
        'write EPIPE'
      );
    });

    it('creates a session for a process without stdin', async () => {
      const child = { ...makeFakeChild(), stdin: null };
      vi.mocked(spawn).mockReturnValue(
        child as unknown as ReturnType<typeof spawn>
      );
      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'local',
      });
      const { sessionId } = result.data as { sessionId: string };

      expect(result.success).toBe(true);
      await expect(
        getHandler('terminal:input')(mockEvent, { sessionId, data: 'x' })
      ).resolves.toMatchObject({
        success: false,
        error: 'Terminal session is closed',
      });
    });

    it('refuses to interrupt an unknown session or one without a pid', async () => {
      await expect(
        getHandler('terminal:interrupt')(mockEvent, { sessionId: 'missing' })
      ).resolves.toMatchObject({
        success: false,
        error: 'No terminal session: missing',
      });

      const child = { ...makeFakeChild(), pid: undefined };
      vi.mocked(spawn).mockReturnValue(
        child as unknown as ReturnType<typeof spawn>
      );
      const { sessionId } = (
        await getHandler('terminal:create')(mockEvent, { kind: 'local' })
      ).data as { sessionId: string };
      vi.mocked(spawn).mockClear();

      await expect(
        getHandler('terminal:interrupt')(mockEvent, { sessionId })
      ).resolves.toMatchObject({ success: false });
      expect(spawn).not.toHaveBeenCalled();
      expect(child.kill).not.toHaveBeenCalled();
    });

    it('ignores a missing pkill on Linux and still interrupts the shell', async () => {
      setPlatform('linux');
      const child = makeFakeChild();
      vi.mocked(spawn).mockReturnValue(
        child as unknown as ReturnType<typeof spawn>
      );
      const { sessionId } = (
        await getHandler('terminal:create')(mockEvent, { kind: 'local' })
      ).data as { sessionId: string };
      const pkill = { on: vi.fn() };
      vi.mocked(spawn).mockReturnValue(
        pkill as unknown as ReturnType<typeof spawn>
      );

      const result = await getHandler('terminal:interrupt')(mockEvent, {
        sessionId,
      });

      expect(result).toMatchObject({ success: true });
      const [event, onError] = pkill.on.mock.calls[0] as [
        string,
        (err: Error) => unknown,
      ];
      expect(event).toBe('error');
      expect(onError(new Error('spawn pkill ENOENT'))).toBeUndefined();
      expect(child.kill).toHaveBeenCalledWith('SIGINT');
    });

    it('interrupts only the children of the shell on Windows', async () => {
      setPlatform('win32');
      const child = makeFakeChild();
      vi.mocked(spawn).mockReturnValue(
        child as unknown as ReturnType<typeof spawn>
      );
      const { sessionId } = (
        await getHandler('terminal:create')(mockEvent, { kind: 'local' })
      ).data as { sessionId: string };

      await getHandler('terminal:interrupt')(mockEvent, { sessionId });

      expect(spawn).toHaveBeenLastCalledWith(
        'powershell.exe',
        expect.arrayContaining([
          expect.stringContaining('ParentProcessId=1234'),
        ]),
        expect.objectContaining({ windowsHide: true, stdio: 'ignore' })
      );
      expect(child.kill).not.toHaveBeenCalled();
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

      if (process.platform === 'win32') {
        expect(spawn).toHaveBeenLastCalledWith(
          'taskkill',
          ['/PID', '1234', '/T', '/F'],
          expect.anything()
        );
      } else {
        expect(child.kill).toHaveBeenCalled();
      }
    });
  });
});
