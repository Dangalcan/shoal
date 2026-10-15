/**
 * Log Stream Service
 *
 * Manages long-running `kubectl logs -f` child processes, the "follow" mode
 * of the log viewer. Each stream is a session identified by a UUID; sessions
 * die when the viewer stops them, when the window that opened them reloads or
 * closes (the IPC layer calls stopOwnedBy), or when the app quits (stopAll).
 *
 * kubectl is spawned directly (no shell) with a validated argument array,
 * mirroring the safe-exec rules for long-running processes. Output is
 * decoded with a StringDecoder (a multibyte character can straddle two
 * chunks), split into lines and handed to the caller in batches so a chatty
 * pod produces a few messages per second instead of one per chunk.
 */

import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { StringDecoder } from 'string_decoder';
import {
  assertContext,
  assertNamespace,
  assertResourceName,
} from '../../utils/k8s-validate';
import log from '../../logger';

/** Lines of history kubectl sends before following (same as get-logs). */
export const LOG_STREAM_TAIL_LINES = 200;
/** Lines that may wait for the next flush; older ones are dropped. */
export const MAX_PENDING_LINES = 5_000;
/** A "line" this long without a newline is handed over as it is. */
export const MAX_LINE_LENGTH = 64 * 1024;
/** Streams that may run at once (the viewer only needs one). */
export const MAX_ACTIVE_STREAMS = 10;
/** How often batched lines are handed to the caller. */
export const FLUSH_INTERVAL_MS = 100;
/** kubectl's stderr kept for the end reason (the tail is the useful part). */
const MAX_STDERR_CHARS = 4 * 1024;

export interface LogStreamArgs {
  contextName: string;
  podName: string;
  namespace: string;
  /** A container of the pod; kubectl picks the default one when omitted. */
  container?: string;
}

/** Why a stream stopped on its own (not through stop()). */
export interface LogStreamEnd {
  reason: string;
  exitCode: number | null;
}

export interface LogStreamCallbacks {
  onLines: (lines: string[]) => void;
  onEnded: (end: LogStreamEnd) => void;
}

interface Session {
  process: ChildProcess;
  ownerId?: number;
  flushTimer: ReturnType<typeof setTimeout> | null;
  pending: string[];
}

/**
 * Turns stdout chunks into lines. A StringDecoder holds the bytes of a
 * multibyte character split across two chunks, and the text after the last
 * newline waits for the next chunk (up to MAX_LINE_LENGTH).
 */
export class LineSplitter {
  private decoder = new StringDecoder('utf8');
  private partial = '';

  push(chunk: Buffer): string[] {
    return this.split(this.decoder.write(chunk));
  }

  /** The rest of the output once the stream closed. */
  end(): string[] {
    const lines = this.split(this.decoder.end());
    if (this.partial) lines.push(this.partial.replace(/\r$/, ''));
    this.partial = '';
    return lines;
  }

  private split(text: string): string[] {
    const parts = (this.partial + text).split('\n');
    this.partial = parts.pop() ?? '';
    const lines = parts.map((line) => line.replace(/\r$/, ''));
    while (this.partial.length >= MAX_LINE_LENGTH) {
      lines.push(this.partial.slice(0, MAX_LINE_LENGTH));
      this.partial = this.partial.slice(MAX_LINE_LENGTH);
    }
    return lines;
  }
}

export class LogStreamService {
  private sessions = new Map<string, Session>();

  /**
   * Starts `kubectl logs -f` and returns its id at once: kubectl prints
   * nothing until the pod writes, so there is no readiness signal to wait
   * for. Failures (pod not found, container not started, kubectl missing)
   * arrive through onEnded with kubectl's message.
   */
  start(
    args: LogStreamArgs,
    callbacks: LogStreamCallbacks,
    ownerId?: number
  ): { streamId: string } {
    const { contextName, podName, namespace, container } = args;
    assertContext(contextName);
    assertResourceName(podName);
    assertNamespace(namespace);
    if (namespace === 'all') {
      throw new Error('A log stream needs the namespace of the pod');
    }
    if (container !== undefined) assertResourceName(container);
    if (this.sessions.size >= MAX_ACTIVE_STREAMS) {
      throw new Error(
        `Too many log streams are open (${MAX_ACTIVE_STREAMS}); close one first`
      );
    }

    const streamId = randomUUID();
    const child = spawn(
      'kubectl',
      [
        'logs',
        podName,
        '--context',
        contextName,
        '-n',
        namespace,
        '--follow',
        `--tail=${LOG_STREAM_TAIL_LINES}`,
        ...(container ? ['-c', container] : []),
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
    );

    const session: Session = {
      process: child,
      ownerId,
      flushTimer: null,
      pending: [],
    };
    this.sessions.set(streamId, session);

    const flush = () => {
      if (session.flushTimer) clearTimeout(session.flushTimer);
      session.flushTimer = null;
      if (session.pending.length === 0) return;
      const lines = session.pending;
      session.pending = [];
      callbacks.onLines(lines);
    };

    const queue = (lines: string[]) => {
      if (lines.length === 0) return;
      session.pending.push(...lines);
      const excess = session.pending.length - MAX_PENDING_LINES;
      if (excess > 0) session.pending.splice(0, excess);
      if (!session.flushTimer) {
        session.flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
      }
    };

    const stdout = new LineSplitter();
    const stderrDecoder = new StringDecoder('utf8');
    let stderr = '';

    child.stdout!.on('data', (data: Buffer) => {
      if (this.sessions.get(streamId) !== session) return;
      queue(stdout.push(data));
    });

    child.stderr!.on('data', (data: Buffer) => {
      stderr = (stderr + stderrDecoder.write(data)).slice(-MAX_STDERR_CHARS);
    });

    // Runs once, for whichever of 'close' and 'error' comes first. A stream
    // that stop() removed ends silently: the viewer asked for it.
    const finish = (end: LogStreamEnd) => {
      if (this.sessions.get(streamId) !== session) return;
      queue(stdout.end());
      flush();
      this.sessions.delete(streamId);
      log.info(`[LogStream] ${streamId} ended: ${end.reason}`);
      callbacks.onEnded(end);
    };

    // 'close' (not 'exit') waits until stdout is drained, so the last lines
    // a dying pod wrote still reach the viewer.
    child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      stderr += stderrDecoder.end();
      finish({ reason: endReason(code, signal, stderr), exitCode: code });
    });

    // A spawn that fails (kubectl missing, permissions) emits 'error' and
    // maybe no 'close'; without a listener the error would be uncaught.
    child.on('error', (err: Error) => {
      finish({
        reason: `Could not start kubectl: ${err.message}`,
        exitCode: null,
      });
    });

    log.info(
      `[LogStream] Started ${streamId}: pod/${podName}` +
        `${container ? ` -c ${container}` : ''} (ns=${namespace}, ctx=${contextName})`
    );
    return { streamId };
  }

  /** Stops a stream without reporting it as ended. False if unknown. */
  stop(streamId: string): boolean {
    const session = this.sessions.get(streamId);
    if (!session) return false;
    // Delete first so the close handler stays quiet for a requested stop.
    this.sessions.delete(streamId);
    if (session.flushTimer) clearTimeout(session.flushTimer);
    session.pending = [];
    session.process.kill();
    log.info(`[LogStream] Stopped ${streamId}`);
    return true;
  }

  /** Stops every stream a window opened (reload, crash, close). */
  stopOwnedBy(ownerId: number): number {
    let stopped = 0;
    for (const [streamId, session] of [...this.sessions]) {
      if (session.ownerId === ownerId && this.stop(streamId)) stopped += 1;
    }
    return stopped;
  }

  /** Number of running streams. */
  get activeCount(): number {
    return this.sessions.size;
  }

  /** Kills every stream (app quit). */
  stopAll(): void {
    for (const streamId of [...this.sessions.keys()]) {
      this.stop(streamId);
    }
  }
}

function endReason(
  code: number | null,
  signal: NodeJS.Signals | null,
  stderr: string
): string {
  const message = stderr.trim();
  if (message) return message;
  if (signal) return `kubectl was stopped (${signal})`;
  if (code === 0) {
    return 'The log stream closed: the container stopped or the pod was deleted';
  }
  return `kubectl exited with code ${code}`;
}

export const logStreamService = new LogStreamService();
