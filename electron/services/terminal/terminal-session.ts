/**
 * A running shell behind a terminal tab, whatever carries its bytes: a
 * pseudo-terminal (node-pty, see pty-session.ts) or plain pipes
 * (child_process.spawn, see pipe-session.ts). The IPC layer only sees this
 * interface.
 */
export type TerminalTransport = 'pty' | 'pipe';

/**
 * The Windows pseudo-terminal behind a `pty` session, in the shape of
 * xterm's `windowsPty` option: ConPTY reflows its own screen buffer when the
 * window is resized, and xterm has to know so it does not reflow as well.
 */
export interface TerminalWindowsPty {
  backend: 'conpty';
  /** Windows build number (for example 22631). */
  buildNumber?: number;
}

export interface TerminalSessionEvents {
  /** Output from the shell, decoded as UTF-8 text. */
  onData: (data: string) => void;
  /** The shell ended, on its own or killed. Fires at most once. */
  onExit: () => void;
  /**
   * The shell could not start (binary gone, permissions). Reported before
   * onExit; the session is unusable afterwards.
   */
  onError: (message: string) => void;
}

export interface TerminalSession {
  readonly transport: TerminalTransport;
  /** Set for `pty` sessions on Windows; undefined elsewhere. */
  readonly windowsPty?: TerminalWindowsPty;
  /** Process id of the shell; undefined when it failed to start. */
  readonly pid: number | undefined;
  /** Sends input to the shell. Throws once the session is closed. */
  write(data: string): void;
  /** Resizes the terminal. A no-op for pipe sessions, which have no size. */
  resize(cols: number, rows: number): void;
  /** Ctrl+C: stops the running command and leaves the shell open. */
  interrupt(): void;
  /** Ends the shell and releases its handles. */
  kill(): void;
}
