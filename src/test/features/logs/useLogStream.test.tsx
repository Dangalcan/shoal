import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  appendLogLines,
  EMPTY_LOG_BUFFER,
  MAX_BUFFERED_LINES,
  useLogStream,
  type UseLogStreamOptions,
} from '../../../features/logs/useLogStream';
import { ApiProvider } from '../../../services/api-context';
import { createMockElectronAPI } from '../../utils/mocks';
import type { LogStreamEnd } from '../../../types.d';
import type { Result } from '../../../types/result';

type LinesListener = (streamId: string, lines: string[]) => void;
type EndedListener = (streamId: string, end: LogStreamEnd) => void;
type StartResult = Result<{ streamId: string }>;

/** A mocked bridge whose stream events the test fires by hand. */
function streamingApi() {
  const api = createMockElectronAPI();
  const lineListeners = new Set<LinesListener>();
  const endListeners = new Set<EndedListener>();
  api.onLogStreamLines.mockImplementation((cb: LinesListener) => {
    lineListeners.add(cb);
    return () => lineListeners.delete(cb);
  });
  api.onLogStreamEnded.mockImplementation((cb: EndedListener) => {
    endListeners.add(cb);
    return () => endListeners.delete(cb);
  });
  let next = 0;
  api.logStreamStart.mockImplementation(async () => ({
    success: true,
    data: { streamId: `stream-${++next}` },
  }));
  return {
    api,
    emitLines: (streamId: string, lines: string[]) =>
      act(() => lineListeners.forEach((cb) => cb(streamId, lines))),
    emitEnded: (streamId: string, end: LogStreamEnd) =>
      act(() => endListeners.forEach((cb) => cb(streamId, end))),
    listeners: () => lineListeners.size + endListeners.size,
  };
}

/** A logStreamStart call the test settles by hand. */
function pendingStart() {
  let resolve: (result: StartResult) => void = () => {};
  let reject: (err: unknown) => void = () => {};
  const promise = new Promise<StartResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type HookProps = Partial<UseLogStreamOptions>;

function renderStream(
  bridge: ReturnType<typeof streamingApi>,
  props: HookProps = {}
) {
  const onStarted = vi.fn();
  const onLines = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider api={bridge.api}>{children}</ApiProvider>
  );
  const view = renderHook(
    (p: HookProps) =>
      useLogStream({
        enabled: true,
        contextName: 'kind-dev',
        podName: 'pod-a',
        namespace: 'default',
        onStarted,
        onLines,
        ...p,
      }),
    { wrapper, initialProps: props }
  );
  return { ...view, onStarted, onLines };
}

describe('useLogStream', () => {
  it('goes live once kubectl starts and forwards its lines', async () => {
    const bridge = streamingApi();
    const { result, onStarted, onLines } = renderStream(bridge, {
      container: 'app',
    });
    expect(result.current.stream).toEqual({ status: 'connecting' });

    await waitFor(() => expect(result.current.stream.status).toBe('live'));
    expect(bridge.api.logStreamStart).toHaveBeenCalledWith({
      contextName: 'kind-dev',
      podName: 'pod-a',
      namespace: 'default',
      container: 'app',
    });
    expect(onStarted).toHaveBeenCalledTimes(1);

    bridge.emitLines('stream-1', ['one', 'two']);
    expect(onLines).toHaveBeenCalledWith(['one', 'two']);
  });

  it('ignores lines and endings of other streams', async () => {
    const bridge = streamingApi();
    const { result, onLines } = renderStream(bridge);
    await waitFor(() => expect(result.current.stream.status).toBe('live'));

    bridge.emitLines('stream-other', ['foreign']);
    bridge.emitEnded('stream-other', { reason: 'not mine', exitCode: 0 });

    expect(onLines).not.toHaveBeenCalled();
    expect(result.current.stream).toEqual({ status: 'live' });
  });

  it('reports why a running stream ended and reconnects on demand', async () => {
    const bridge = streamingApi();
    const { result } = renderStream(bridge);
    await waitFor(() => expect(result.current.stream.status).toBe('live'));

    bridge.emitEnded('stream-1', { reason: 'pod deleted', exitCode: 1 });
    expect(result.current.stream).toEqual({
      status: 'ended',
      reason: 'pod deleted',
    });

    act(() => result.current.reconnect());
    await waitFor(() => expect(result.current.stream.status).toBe('live'));
    expect(bridge.api.logStreamStart).toHaveBeenCalledTimes(2);
    // The ended stream is not stopped again: kubectl already exited.
    expect(bridge.api.logStreamStop).not.toHaveBeenCalled();
  });

  it('ends with the error of a stream that could not start', async () => {
    const bridge = streamingApi();
    bridge.api.logStreamStart.mockResolvedValueOnce({
      success: false,
      error: 'kubectl is not installed',
    });
    const { result, onStarted } = renderStream(bridge);

    await waitFor(() =>
      expect(result.current.stream).toEqual({
        status: 'ended',
        reason: 'kubectl is not installed',
      })
    );
    expect(onStarted).not.toHaveBeenCalled();
  });

  it('ends with the message of a start that throws an Error', async () => {
    const bridge = streamingApi();
    bridge.api.logStreamStart.mockRejectedValueOnce(new Error('ipc closed'));
    const { result } = renderStream(bridge);

    await waitFor(() =>
      expect(result.current.stream).toEqual({
        status: 'ended',
        reason: 'ipc closed',
      })
    );
  });

  it('ends with a generic message when the start throws something else', async () => {
    const bridge = streamingApi();
    bridge.api.logStreamStart.mockRejectedValueOnce('boom');
    const { result } = renderStream(bridge);

    await waitFor(() =>
      expect(result.current.stream).toEqual({
        status: 'ended',
        reason: 'An unexpected error occurred',
      })
    );
  });

  it('stops the running stream when follow is turned off', async () => {
    const bridge = streamingApi();
    const { result, rerender } = renderStream(bridge);
    await waitFor(() => expect(result.current.stream.status).toBe('live'));

    rerender({ enabled: false });

    expect(bridge.api.logStreamStop).toHaveBeenCalledWith('stream-1');
    expect(bridge.listeners()).toBe(0);
    expect(result.current.stream).toEqual({ status: 'connecting' });
  });

  it('starts a new stream for another container', async () => {
    const bridge = streamingApi();
    const { result, rerender } = renderStream(bridge, { container: 'app' });
    await waitFor(() => expect(result.current.stream.status).toBe('live'));

    rerender({ container: 'sidecar' });
    await waitFor(() => expect(result.current.stream.status).toBe('live'));

    expect(bridge.api.logStreamStop).toHaveBeenCalledWith('stream-1');
    expect(bridge.api.logStreamStart).toHaveBeenLastCalledWith(
      expect.objectContaining({ container: 'sidecar' })
    );
  });

  it.each([
    ['disabled', { enabled: false }],
    ['without a pod', { podName: '' }],
    ['without a namespace', { namespace: '' }],
    ['without a context', { contextName: '' }],
  ] as const)('does not start while %s', (_, props) => {
    const bridge = streamingApi();
    const { result } = renderStream(bridge, props);

    expect(bridge.api.logStreamStart).not.toHaveBeenCalled();
    expect(result.current.stream).toEqual({ status: 'connecting' });
  });

  it('stops a stream that started after follow was turned off', async () => {
    const bridge = streamingApi();
    const start = pendingStart();
    bridge.api.logStreamStart.mockReturnValueOnce(start.promise);
    const { result, rerender, onStarted } = renderStream(bridge);

    rerender({ enabled: false });
    await act(async () => {
      start.resolve({ success: true, data: { streamId: 'late' } });
    });

    expect(bridge.api.logStreamStop).toHaveBeenCalledWith('late');
    expect(onStarted).not.toHaveBeenCalled();
    expect(result.current.stream).toEqual({ status: 'connecting' });
  });

  it('has nothing to stop when a start fails after follow was turned off', async () => {
    const bridge = streamingApi();
    const start = pendingStart();
    bridge.api.logStreamStart.mockReturnValueOnce(start.promise);
    const { result, rerender } = renderStream(bridge);

    rerender({ enabled: false });
    await act(async () => {
      start.resolve({ success: false, error: 'pod not found' });
    });

    expect(bridge.api.logStreamStop).not.toHaveBeenCalled();
    expect(result.current.stream).toEqual({ status: 'connecting' });
  });

  it('ignores a start that throws after follow was turned off', async () => {
    const bridge = streamingApi();
    const start = pendingStart();
    bridge.api.logStreamStart.mockReturnValueOnce(start.promise);
    const { result, rerender } = renderStream(bridge);

    rerender({ enabled: false });
    await act(async () => {
      start.reject(new Error('ipc closed'));
    });

    expect(result.current.stream).toEqual({ status: 'connecting' });
  });
});

describe('appendLogLines', () => {
  it('appends streamed lines and marks the buffer as a stream', () => {
    const buffer = appendLogLines({ ...EMPTY_LOG_BUFFER, lines: ['a'] }, [
      'b',
      'c',
    ]);

    expect(buffer).toEqual({
      lines: ['a', 'b', 'c'],
      truncated: false,
      source: 'stream',
    });
  });

  it('keeps only the newest lines past the limit', () => {
    const full = Array.from({ length: MAX_BUFFERED_LINES }, (_, i) => `${i}`);
    const buffer = appendLogLines({ ...EMPTY_LOG_BUFFER, lines: full }, [
      'new',
    ]);

    expect(buffer.lines).toHaveLength(MAX_BUFFERED_LINES);
    expect(buffer.lines[0]).toBe('1');
    expect(buffer.lines.at(-1)).toBe('new');
    expect(buffer.truncated).toBe(true);
  });

  it('remembers an earlier truncation', () => {
    const buffer = appendLogLines(
      { lines: ['x'], truncated: true, source: 'stream' },
      ['y']
    );

    expect(buffer.truncated).toBe(true);
  });
});
