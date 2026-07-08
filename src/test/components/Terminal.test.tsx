import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '../utils';
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

// Captured electron listener callbacks
let capturedOutput: (sid: string, data: string) => void;
let capturedExit: (sid: string) => void;
const cleanupOutput = vi.fn();
const cleanupExit = vi.fn();

const renderTerminal = (kind: 'local' | 'pod-exec', sessionId = 's1') => {
  window.electron.onTerminalOutput = vi.fn((cb: any) => {
    capturedOutput = cb;
    return cleanupOutput;
  }) as any;
  window.electron.onTerminalExited = vi.fn((cb: any) => {
    capturedExit = cb;
    return cleanupExit;
  }) as any;
  return render(<Terminal sessionId={sessionId} kind={kind} />);
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
    expect(window.electron.terminalInterrupt).toHaveBeenCalledWith('s1');

    cb('clear\r'); // Enter with clear command (local)
    expect(termClear).toHaveBeenCalled();
    expect(window.electron.terminalInput).toHaveBeenCalledWith('s1', 'clear\r\n');

    termClear.mockClear();
    cb('cls\r'); // 'cls' alias also clears
    expect(termClear).toHaveBeenCalled();

    termClear.mockClear();
    cb('ls\r'); // local Enter, non-clear command → no clear()
    expect(termClear).not.toHaveBeenCalled();
    expect(window.electron.terminalInput).toHaveBeenCalledWith('s1', 'ls\r\n');

    termWrite.mockClear();
    cb('é'); // code > 0x7e → ignored (no branch matches)
    expect(termWrite).not.toHaveBeenCalled();
  });

  it('uses \\n eol for pod-exec Enter (no clear branch)', () => {
    renderTerminal('pod-exec');
    const cb = onDataCbs[0]!;
    cb('ls\r');
    expect(window.electron.terminalInput).toHaveBeenCalledWith('s1', 'ls\n');
    expect(termClear).not.toHaveBeenCalled();
  });

  it('routes terminal output by session id (pod-exec replaces \\n)', () => {
    renderTerminal('pod-exec');

    capturedOutput('other', 'ignored\n');
    expect(termWrite).not.toHaveBeenCalledWith('ignored\r\n');

    capturedOutput('s1', 'x\n');
    expect(termWrite).toHaveBeenCalledWith('x\r\n');
  });

  it('writes local output without newline replacement', () => {
    renderTerminal('local');
    capturedOutput('s1', 'raw');
    expect(termWrite).toHaveBeenCalledWith('raw');
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
    expect(window.electron.terminalResize).toHaveBeenCalledWith('s1', 80, 24);

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
