import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import {
  FLUSH_INTERVAL_MS,
  LineSplitter,
  LogStreamService,
  MAX_ACTIVE_STREAMS,
  MAX_LINE_LENGTH,
  MAX_PENDING_LINES,
} from '../services/logs/log-stream-service';
import type { LogStreamArgs } from '../services/logs/log-stream-service';

vi.mock('../logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('child_process', () => {
  const spawn = vi.fn();
  return { spawn, default: { spawn } };
});

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  pid = 4321;
  kill = vi.fn(() => {
    this.emit('close', null, 'SIGTERM');
    return true;
  });
}

const validArgs: LogStreamArgs = {
  contextName: 'kind-test',
  namespace: 'default',
  podName: 'my-pod',
};

function startStream(
  service: LogStreamService,
  args: LogStreamArgs = validArgs,
  ownerId?: number
) {
  const child = new FakeChild();
  vi.mocked(spawn).mockReturnValueOnce(
    child as unknown as ReturnType<typeof spawn>
  );
  const onLines = vi.fn();
  const onEnded = vi.fn();
  const { streamId } = service.start(args, { onLines, onEnded }, ownerId);
  return { child, onLines, onEnded, streamId };
}

describe('LogStreamService', () => {
  let service: LogStreamService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    service = new LogStreamService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('spawns kubectl logs --follow without a shell', () => {
    const { streamId } = startStream(service);

    expect(streamId).toBeTruthy();
    expect(spawn).toHaveBeenCalledWith(
      'kubectl',
      [
        'logs',
        'my-pod',
        '--context',
        'kind-test',
        '-n',
        'default',
        '--follow',
        '--tail=200',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
    );
    expect(service.activeCount).toBe(1);
  });

  it('passes the container when one is chosen', () => {
    startStream(service, { ...validArgs, container: 'sidecar' });

    expect(vi.mocked(spawn).mock.calls[0]![1]).toEqual(
      expect.arrayContaining(['-c', 'sidecar'])
    );
  });

  it.each([
    [{ ...validArgs, contextName: '--kubeconfig=/evil' }, /context name/],
    [{ ...validArgs, podName: 'pod;rm -rf' }, /resource name/],
    [{ ...validArgs, namespace: 'Bad_NS' }, /namespace/],
    [{ ...validArgs, namespace: 'all' }, /namespace of the pod/],
    [{ ...validArgs, container: '-c' }, /resource name/],
  ])('rejects invalid input without spawning (%o)', (args, message) => {
    expect(() =>
      service.start(args, { onLines: vi.fn(), onEnded: vi.fn() })
    ).toThrow(message);
    expect(spawn).not.toHaveBeenCalled();
  });

  it('batches lines and hands them over on the flush interval', async () => {
    const { child, onLines } = startStream(service);

    child.stdout.emit('data', Buffer.from('first\nsecond\n'));
    child.stdout.emit('data', Buffer.from('third\r\n'));
    expect(onLines).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    expect(onLines).toHaveBeenCalledTimes(1);
    expect(onLines).toHaveBeenCalledWith(['first', 'second', 'third']);
  });

  it('joins a line split across chunks', async () => {
    const { child, onLines } = startStream(service);

    child.stdout.emit('data', Buffer.from('hel'));
    child.stdout.emit('data', Buffer.from('lo\nwor'));
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    expect(onLines).toHaveBeenLastCalledWith(['hello']);

    child.stdout.emit('data', Buffer.from('ld\n'));
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    expect(onLines).toHaveBeenLastCalledWith(['world']);
  });

  it('keeps a multibyte character split across chunks intact', async () => {
    const { child, onLines } = startStream(service);
    const bytes = Buffer.from('café ✓ 日本\n', 'utf8');
    // Cut inside the three-byte check mark.
    const cut = bytes.indexOf(Buffer.from('✓', 'utf8')) + 1;

    child.stdout.emit('data', bytes.subarray(0, cut));
    child.stdout.emit('data', bytes.subarray(cut));
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(onLines).toHaveBeenCalledWith(['café ✓ 日本']);
  });

  it('drops the oldest pending lines past the cap', async () => {
    const { child, onLines } = startStream(service);
    const total = MAX_PENDING_LINES + 10;
    const text = Array.from({ length: total }, (_, i) => `l${i}`).join('\n');

    child.stdout.emit('data', Buffer.from(`${text}\n`));
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    const lines = onLines.mock.calls[0]![0] as string[];
    expect(lines).toHaveLength(MAX_PENDING_LINES);
    expect(lines[0]).toBe('l10');
    expect(lines.at(-1)).toBe(`l${total - 1}`);
  });

  it('flushes the last lines and reports the end when kubectl exits', () => {
    const { child, onLines, onEnded } = startStream(service);

    child.stdout.emit('data', Buffer.from('bye\nno newline'));
    child.emit('close', 0, null);

    expect(onLines).toHaveBeenCalledWith(['bye', 'no newline']);
    expect(onEnded).toHaveBeenCalledWith({
      reason: expect.stringMatching(/container stopped or the pod was deleted/),
      exitCode: 0,
    });
    expect(onLines.mock.invocationCallOrder[0]).toBeLessThan(
      onEnded.mock.invocationCallOrder[0]!
    );
    expect(service.activeCount).toBe(0);
  });

  it("uses kubectl's stderr as the end reason", () => {
    const { child, onLines, onEnded } = startStream(service);

    child.stderr.emit(
      'data',
      Buffer.from('Error from server (NotFound): pods "my-pod" not found\n')
    );
    child.emit('close', 1, null);

    expect(onLines).not.toHaveBeenCalled();
    expect(onEnded).toHaveBeenCalledWith({
      reason: 'Error from server (NotFound): pods "my-pod" not found',
      exitCode: 1,
    });
  });

  it('keeps the last two distinct stderr lines of a container that never started', () => {
    const { child, onEnded } = startStream(service);
    const waiting = (why: string) =>
      `container "app" in pod "my-pod" is waiting to start: ${why}\n`;

    child.stderr.emit(
      'data',
      Buffer.from(
        waiting('ContainerCreating').repeat(3) +
          waiting("image can't be pulled").repeat(5) +
          'error: context deadline exceeded\n'
      )
    );
    child.emit('close', 1, null);

    expect(onEnded).toHaveBeenCalledWith({
      reason:
        'container "app" in pod "my-pod" is waiting to start: ' +
        "image can't be pulled · error: context deadline exceeded",
      exitCode: 1,
    });
  });

  it('reports the exit code or signal when stderr is empty', () => {
    const a = startStream(service);
    a.child.emit('close', 2, null);
    expect(a.onEnded).toHaveBeenCalledWith({
      reason: 'kubectl exited with code 2',
      exitCode: 2,
    });

    const b = startStream(service);
    b.child.emit('close', null, 'SIGKILL');
    expect(b.onEnded).toHaveBeenCalledWith({
      reason: 'kubectl was stopped (SIGKILL)',
      exitCode: null,
    });
  });

  it('reports a spawn failure once, even if close follows', () => {
    const { child, onEnded } = startStream(service);

    child.emit('error', new Error('spawn kubectl ENOENT'));
    child.emit('close', -2, null);

    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(onEnded).toHaveBeenCalledWith({
      reason: 'Could not start kubectl: spawn kubectl ENOENT',
      exitCode: null,
    });
    expect(service.activeCount).toBe(0);
  });

  it('stop kills kubectl quietly and drops pending lines', async () => {
    const { child, onLines, onEnded, streamId } = startStream(service);
    child.stdout.emit('data', Buffer.from('pending\n'));

    expect(service.stop(streamId)).toBe(true);
    expect(child.kill).toHaveBeenCalled();

    // Output that was still in the pipe is ignored too.
    child.stdout.emit('data', Buffer.from('late\n'));
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS * 2);
    expect(onLines).not.toHaveBeenCalled();
    expect(onEnded).not.toHaveBeenCalled();
    expect(service.stop(streamId)).toBe(false);
  });

  it('stopOwnedBy stops only the streams of that window', () => {
    const a = startStream(service, validArgs, 1);
    const b = startStream(service, validArgs, 1);
    const c = startStream(service, validArgs, 2);

    expect(service.stopOwnedBy(1)).toBe(2);
    expect(a.child.kill).toHaveBeenCalled();
    expect(b.child.kill).toHaveBeenCalled();
    expect(c.child.kill).not.toHaveBeenCalled();
    expect(service.activeCount).toBe(1);
    expect(service.stopOwnedBy(1)).toBe(0);
  });

  it('stopAll kills every stream', () => {
    const a = startStream(service);
    const b = startStream(service);

    service.stopAll();

    expect(a.child.kill).toHaveBeenCalled();
    expect(b.child.kill).toHaveBeenCalled();
    expect(service.activeCount).toBe(0);
  });

  it('refuses more than MAX_ACTIVE_STREAMS at once', () => {
    for (let i = 0; i < MAX_ACTIVE_STREAMS; i++) startStream(service);

    expect(() =>
      service.start(validArgs, { onLines: vi.fn(), onEnded: vi.fn() })
    ).toThrow(/Too many log streams/);
    expect(spawn).toHaveBeenCalledTimes(MAX_ACTIVE_STREAMS);
  });
});

describe('LineSplitter', () => {
  it('cuts a line longer than MAX_LINE_LENGTH without a newline', () => {
    const splitter = new LineSplitter();
    const long = 'x'.repeat(MAX_LINE_LENGTH + 5);

    expect(splitter.push(Buffer.from(long))).toEqual([
      'x'.repeat(MAX_LINE_LENGTH),
    ]);
    expect(splitter.end()).toEqual(['xxxxx']);
  });

  it('returns nothing at the end when the output ended with a newline', () => {
    const splitter = new LineSplitter();

    expect(splitter.push(Buffer.from('a\r\n'))).toEqual(['a']);
    expect(splitter.end()).toEqual([]);
  });
});
