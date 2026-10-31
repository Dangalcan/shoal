import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '../utils';
import { createMockElectronAPI } from '../utils/mocks';
import { Terminal } from '../../components/Terminal';

// ── xterm mocks ──────────────────────────────────────────────────────────────
// Shared spies so the onData handler's terminal.write/clear are assertable.
const termWrite = vi.fn();
const termClear = vi.fn();
const termDispose = vi.fn();
const fitFn = vi.fn();
const onDataCbs: Array<(d: string) => void> = [];

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    loadAddon() {}
    open() {}
    write = termWrite;
    clear = termClear;
    dispose = termDispose;
    onData(cb: (d: string) => void) {
      onDataCbs.push(cb);
    }
  },
}));
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit = fitFn;
  },
}));
vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

// ── ResizeObserver capture ───────────────────────────────────────────────────
let roCb: () => void;
beforeEach(() => {
  onDataCbs.length = 0;
  (globalThis as any).ResizeObserver = class {
    constructor(cb: () => void) {
      roCb = cb;
    }
    observe() {}
    disconnect() {}
  };
});

// Captured bridge listener callbacks
let capturedOutput: (sid: string, data: string) => void;
let capturedExit: (sid: string) => void;
const cleanupOutput = vi.fn();
const cleanupExit = vi.fn();

let api: ReturnType<typeof createMockElectronAPI>;

const renderTerminal = (
  kind: 'local' | 'pod-exec',
  sessionId = 's1',
  shellFamily?: 'windows' | 'unix'
) => {
  api = createMockElectronAPI({
    onTerminalOutput: vi.fn((cb: any) => {
      capturedOutput = cb;
      return cleanupOutput;
    }) as any,
    onTerminalExited: vi.fn((cb: any) => {
      capturedExit = cb;
      return cleanupExit;
    }) as any,
  });
  return render(
    <Terminal sessionId={sessionId} kind={kind} shellFamily={shellFamily} />,
    { api }
  );
};

describe('Terminal', () => {
  it('handles local input: printable, backspace, ctrl-c, enter+clear', () => {
    renderTerminal('local');
    const cb = onDataCbs[0]!;

    cb('a'); // printable
    expect(termWrite).toHaveBeenCalledWith('a');

    cb('\x7f'); // backspace with buffer
    expect(termWrite).toHaveBeenCalledWith('\b \b');

    termWrite.mockClear();
    cb('\x7f'); // backspace, empty buffer → no write
    expect(termWrite).not.toHaveBeenCalledWith('\b \b');

    cb('\x03'); // Ctrl-C
    expect(termWrite).toHaveBeenCalledWith('^C\r\n');
    expect(api.terminalInterrupt).toHaveBeenCalledWith('s1');

    cb('clear\r'); // Enter with clear command (local)
    expect(termClear).toHaveBeenCalled();
    expect(api.terminalInput).toHaveBeenCalledWith('s1', 'clear\r\n');

    termClear.mockClear();
    cb('cls\r'); // 'cls' alias also clears
    expect(termClear).toHaveBeenCalled();

    termClear.mockClear();
    cb('ls\r'); // local Enter, non-clear command → no clear()
    expect(termClear).not.toHaveBeenCalled();
    expect(api.terminalInput).toHaveBeenCalledWith('s1', 'ls\r\n');

    termWrite.mockClear();
    cb('é'); // code > 0x7e → ignored (no branch matches)
    expect(termWrite).not.toHaveBeenCalled();
  });

  it('uses \\n eol and output conversion for local unix shells (Git Bash/WSL)', () => {
    renderTerminal('local', 's1', 'unix');
    const cb = onDataCbs[0]!;

    // Ready banner shown because unix shells print nothing without a PTY
    expect(termWrite).toHaveBeenCalledWith(
      '\x1b[90m[Shell ready — no PTY prompt; type a command and press Enter]\x1b[0m\r\n'
    );

    cb('ls\r'); // local unix shell → \n eol, but clear intercept still local
    expect(api.terminalInput).toHaveBeenCalledWith('s1', 'ls\n');

    cb('clear\r'); // 'clear' intercept applies to local regardless of family
    expect(termClear).toHaveBeenCalled();

    capturedOutput('s1', 'x\n'); // unix output normalized to \r\n
    expect(termWrite).toHaveBeenCalledWith('x\r\n');
  });

  it('uses \\n eol for pod-exec Enter (no clear branch)', () => {
    renderTerminal('pod-exec');
    const cb = onDataCbs[0]!;
    cb('ls\r');
    expect(api.terminalInput).toHaveBeenCalledWith('s1', 'ls\n');
    expect(termClear).not.toHaveBeenCalled();
  });

  it('routes terminal output by session id (pod-exec replaces \\n)', () => {
    renderTerminal('pod-exec');

    capturedOutput('other', 'ignored\n');
    expect(termWrite).not.toHaveBeenCalledWith('ignored\r\n');

    capturedOutput('s1', 'x\n');
    expect(termWrite).toHaveBeenCalledWith('x\r\n');
  });

  it('returns to column 0 after bare line feeds from a Windows shell', () => {
    renderTerminal('local', 's1', 'windows');
    // PowerShell prints \r\n; a native command such as kubectl prints \n.
    capturedOutput('s1', 'PS C:\\> kubectl get pods\r\nNAME\nweb-1\n');
    expect(termWrite).toHaveBeenCalledWith(
      'PS C:\\> kubectl get pods\r\nNAME\r\nweb-1\r\n'
    );
  });

  it('writes process-exited banner only for matching session', () => {
    renderTerminal('local');

    capturedExit('other');
    expect(termWrite).not.toHaveBeenCalledWith(
      '\r\n\x1b[31m[Process exited]\x1b[0m\r\n'
    );

    capturedExit('s1');
    expect(termWrite).toHaveBeenCalledWith(
      '\r\n\x1b[31m[Process exited]\x1b[0m\r\n'
    );
  });

  it('resizes on ResizeObserver callback and swallows fit errors', () => {
    renderTerminal('local');

    roCb(); // fit success → terminalResize
    expect(api.terminalResize).toHaveBeenCalledWith('s1', 80, 24);

    fitFn.mockImplementationOnce(() => {
      throw new Error('fit race');
    });
    expect(() => roCb()).not.toThrow(); // catch branch
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderTerminal('local');
    expect(() => unmount()).not.toThrow();
    expect(cleanupOutput).toHaveBeenCalled();
    expect(cleanupExit).toHaveBeenCalled();
    expect(termDispose).toHaveBeenCalled();
  });
});
