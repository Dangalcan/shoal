import { describe, it, expect, vi, beforeEach } from 'vitest';
import log from '../logger';
import { loadNodePty } from '../services/terminal/node-pty-loader';
import type { NodePty } from '../services/terminal/node-pty-loader';
import { spawnPtySession } from '../services/terminal/pty-session';
import type { TerminalSessionEvents } from '../services/terminal/terminal-session';

vi.mock('../logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../services/terminal/node-pty-loader', () => ({
  loadNodePty: vi.fn(() => null),
}));

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

function makeEvents(): TerminalSessionEvents {
  return { onData: vi.fn(), onExit: vi.fn(), onError: vi.fn() };
}

const options = {
  sessionId: 'sid',
  file: 'powershell.exe',
  args: ['-NoLogo'],
  cwd: 'C:\\Users\\me',
  cols: 120,
  rows: 40,
};

describe('spawnPtySession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadNodePty).mockReturnValue(null);
  });

  it('returns null when node-pty is not available', () => {
    const events = makeEvents();

    expect(spawnPtySession(options, events)).toBeNull();
    expect(events.onError).not.toHaveBeenCalled();
  });

  it('returns null and logs when the pty spawn itself fails', () => {
    const ptySpawn = vi.fn(() => {
      throw new Error('CreatePseudoConsole failed');
    });
    vi.mocked(loadNodePty).mockReturnValue({
      spawn: ptySpawn,
    } as unknown as NodePty);
    const events = makeEvents();

    expect(spawnPtySession(options, events)).toBeNull();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('could not start powershell.exe'),
      'CreatePseudoConsole failed'
    );
    expect(events.onExit).not.toHaveBeenCalled();
  });

  it('spawns the shell with a terminal name, size, cwd and the bundled ConPTY', () => {
    const pty = makeFakePty();
    const ptySpawn = vi.fn(() => pty);
    vi.mocked(loadNodePty).mockReturnValue({
      spawn: ptySpawn,
    } as unknown as NodePty);

    const session = spawnPtySession(options, makeEvents());

    expect(session?.transport).toBe('pty');
    expect(session?.pid).toBe(4321);
    if (process.platform === 'win32') {
      expect(session?.windowsPty).toEqual({
        backend: 'conpty',
        buildNumber: expect.any(Number),
      });
    } else {
      expect(session?.windowsPty).toBeUndefined();
    }
    expect(ptySpawn).toHaveBeenCalledWith('powershell.exe', ['-NoLogo'], {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: 'C:\\Users\\me',
      env: process.env,
      useConptyDll: true,
    });
  });

  it('forwards data and exit, and refuses writes once the shell is gone', () => {
    const pty = makeFakePty();
    vi.mocked(loadNodePty).mockReturnValue({
      spawn: vi.fn(() => pty),
    } as unknown as NodePty);
    const events = makeEvents();
    const session = spawnPtySession(options, events)!;

    const onData = pty.onData.mock.calls[0][0] as (data: string) => void;
    const onExit = pty.onExit.mock.calls[0][0] as () => void;

    session.write('ls\r');
    session.resize(100, 30);
    session.interrupt();
    expect(pty.write).toHaveBeenNthCalledWith(1, 'ls\r');
    expect(pty.resize).toHaveBeenCalledWith(100, 30);
    expect(pty.write).toHaveBeenNthCalledWith(2, '\x03');

    onData('PS C:\\> ');
    expect(events.onData).toHaveBeenCalledWith('PS C:\\> ');

    onExit();
    expect(events.onExit).toHaveBeenCalledTimes(1);
    expect(() => session.write('x')).toThrow('Terminal session is closed');
    pty.resize.mockClear();
    pty.write.mockClear();
    session.resize(80, 24);
    session.interrupt();
    session.kill();
    expect(pty.resize).not.toHaveBeenCalled();
    expect(pty.write).not.toHaveBeenCalled();
    expect(pty.kill).not.toHaveBeenCalled();
  });

  it('kills the pty while it is open', () => {
    const pty = makeFakePty();
    vi.mocked(loadNodePty).mockReturnValue({
      spawn: vi.fn(() => pty),
    } as unknown as NodePty);

    const session = spawnPtySession(options, makeEvents())!;
    session.kill();

    expect(pty.kill).toHaveBeenCalledTimes(1);
  });
});
