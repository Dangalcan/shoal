import { describe, it, expect, vi, beforeEach } from 'vitest';
// Unmock component for unit testing
vi.unmock('../../../components/modals/LogViewerModal');

import {
  act,
  createMockElectronAPI,
  fireEvent,
  render,
  screen,
  waitFor,
} from '../../utils';
import { LogViewerModal } from '../../../components/modals/LogViewerModal';
import { MAX_BUFFERED_LINES } from '../../../features/logs/useLogStream';
import type { LogStreamEnd } from '../../../types.d';

type LinesListener = (streamId: string, lines: string[]) => void;
type EndedListener = (streamId: string, end: LogStreamEnd) => void;

/** A mocked bridge whose stream events the test fires by hand. */
function streamingApi() {
  const api = createMockElectronAPI();
  const lineListeners = new Set<LinesListener>();
  const endListeners = new Set<EndedListener>();
  api.getLogs.mockResolvedValue({ success: true, data: 'snapshot line' });
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

interface ModalProps {
  isOpen?: boolean;
  podName?: string;
  containers?: string[];
}

function modal({
  isOpen = true,
  podName = 'pod-a',
  containers = ['app', 'sidecar'],
}: ModalProps = {}) {
  return (
    <LogViewerModal
      isOpen={isOpen}
      onClose={vi.fn()}
      clusterName="kind-dev"
      podName={podName}
      namespace="default"
      containers={containers}
    />
  );
}

const content = () => screen.getByTestId('log-content');
const status = () => screen.getByTestId('log-stream-status');
const followButton = () => screen.getByRole('button', { name: /follow/i });

/** Opens the viewer and turns Follow on; resolves once stream-1 is live. */
async function startFollowing(bridge: ReturnType<typeof streamingApi>) {
  const view = render(modal(), { api: bridge.api });
  await waitFor(() => expect(content()).toHaveTextContent('snapshot line'));
  fireEvent.click(followButton());
  await waitFor(() => expect(status()).toHaveTextContent('Live'));
  return view;
}

describe('LogViewerModal follow mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('streams new lines for the pod once Follow is on', async () => {
    const bridge = streamingApi();
    await startFollowing(bridge);

    expect(bridge.api.logStreamStart).toHaveBeenCalledWith({
      contextName: 'kind-dev',
      podName: 'pod-a',
      namespace: 'default',
      container: 'app',
    });
    expect(followButton()).toHaveAttribute('aria-pressed', 'true');
    // The stream replaces the snapshot with its own last lines.
    expect(content()).toHaveTextContent('Waiting for new lines...');

    bridge.emitLines('stream-1', ['first', 'second']);
    bridge.emitLines('stream-1', ['third']);
    expect(content().textContent).toBe('first\nsecond\nthird');

    // Lines of another stream (an old one, another window) are ignored.
    bridge.emitLines('stream-9', ['not mine']);
    expect(content()).not.toHaveTextContent('not mine');
  });

  it('hides auto-refresh and manual refresh while following', async () => {
    const bridge = streamingApi();
    await startFollowing(bridge);

    expect(screen.queryByRole('button', { name: /auto-refresh/i })).toBeNull();
    expect(screen.queryByTitle('Refresh Now')).toBeNull();
  });

  it('keeps only the newest lines past the buffer cap', async () => {
    const bridge = streamingApi();
    await startFollowing(bridge);

    const lines = Array.from(
      { length: MAX_BUFFERED_LINES + 10 },
      (_, i) => `line-${i}`
    );
    bridge.emitLines('stream-1', lines.slice(0, 3000));
    bridge.emitLines('stream-1', lines.slice(3000));

    const shown = content().textContent!.split('\n');
    expect(shown).toHaveLength(MAX_BUFFERED_LINES);
    expect(shown[0]).toBe('line-10');
    expect(shown.at(-1)).toBe(`line-${MAX_BUFFERED_LINES + 9}`);
    expect(status()).toHaveTextContent('last 5,000 lines kept');
  });

  it('shows why the stream ended and reconnects on request', async () => {
    const bridge = streamingApi();
    await startFollowing(bridge);
    bridge.emitLines('stream-1', ['last words']);

    bridge.emitEnded('stream-1', {
      reason:
        'The log stream closed: the container stopped or the pod was deleted',
      exitCode: 0,
    });

    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('The log stream ended.');
    expect(banner).toHaveTextContent('the pod was deleted');
    expect(status()).toHaveTextContent('Stream ended');
    // What the pod wrote before it went away stays visible.
    expect(content()).toHaveTextContent('last words');
    // An ended stream is not stopped again.
    expect(bridge.api.logStreamStop).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /reconnect/i }));
    await waitFor(() =>
      expect(bridge.api.logStreamStart).toHaveBeenCalledTimes(2)
    );
    await waitFor(() => expect(status()).toHaveTextContent('Live'));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('ignores the end of a stream it no longer follows', async () => {
    const bridge = streamingApi();
    await startFollowing(bridge);

    bridge.emitEnded('stream-7', { reason: 'other', exitCode: 1 });

    expect(screen.queryByRole('status')).toBeNull();
    expect(status()).toHaveTextContent('Live');
  });

  it('reports a stream that could not start', async () => {
    const bridge = streamingApi();
    bridge.api.logStreamStart.mockResolvedValueOnce({
      success: false,
      error: 'Too many log streams are open (10); close one first',
    });
    render(modal(), { api: bridge.api });
    await waitFor(() => expect(content()).toHaveTextContent('snapshot line'));

    fireEvent.click(followButton());

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Too many log streams'
    );
    // The snapshot stays on screen.
    expect(content()).toHaveTextContent('snapshot line');
  });

  it('reports a bridge failure as the end reason', async () => {
    const bridge = streamingApi();
    bridge.api.logStreamStart.mockRejectedValueOnce(new Error('IPC down'));
    render(modal(), { api: bridge.api });
    await waitFor(() => expect(content()).toHaveTextContent('snapshot line'));

    fireEvent.click(followButton());

    expect(await screen.findByRole('status')).toHaveTextContent('IPC down');
  });

  it('turning Follow off stops the stream and keeps its lines', async () => {
    const bridge = streamingApi();
    await startFollowing(bridge);
    bridge.emitLines('stream-1', ['kept']);
    const snapshotCalls = bridge.api.getLogs.mock.calls.length;

    fireEvent.click(followButton());

    expect(bridge.api.logStreamStop).toHaveBeenCalledWith('stream-1');
    expect(followButton()).toHaveAttribute('aria-pressed', 'false');
    expect(content()).toHaveTextContent('kept');
    expect(status()).toHaveTextContent('Follow stopped');
    expect(bridge.api.getLogs).toHaveBeenCalledTimes(snapshotCalls);
    expect(bridge.listeners()).toBe(0);
  });

  it('stops the stream when the viewer closes', async () => {
    const bridge = streamingApi();
    const view = await startFollowing(bridge);

    view.rerender(modal({ isOpen: false }));

    expect(bridge.api.logStreamStop).toHaveBeenCalledWith('stream-1');
    expect(bridge.listeners()).toBe(0);
  });

  it('restarts the stream for another container', async () => {
    const bridge = streamingApi();
    await startFollowing(bridge);
    const snapshotCalls = bridge.api.getLogs.mock.calls.length;

    fireEvent.change(screen.getByLabelText('Container'), {
      target: { value: 'sidecar' },
    });

    expect(bridge.api.logStreamStop).toHaveBeenCalledWith('stream-1');
    await waitFor(() =>
      expect(bridge.api.logStreamStart).toHaveBeenLastCalledWith(
        expect.objectContaining({ container: 'sidecar' })
      )
    );
    await waitFor(() => expect(status()).toHaveTextContent('Live'));
    // The stream, not a snapshot, fills the viewer.
    expect(bridge.api.getLogs).toHaveBeenCalledTimes(snapshotCalls);
  });

  it('a different pod stops the stream and starts without Follow', async () => {
    const bridge = streamingApi();
    const view = await startFollowing(bridge);
    bridge.emitLines('stream-1', ['pod-a line']);

    view.rerender(modal({ podName: 'pod-b' }));

    expect(bridge.api.logStreamStop).toHaveBeenCalledWith('stream-1');
    expect(followButton()).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() =>
      expect(bridge.api.getLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ podName: 'pod-b' })
      )
    );
    expect(content()).not.toHaveTextContent('pod-a line');

    // Back to the first pod: a snapshot again, no stream.
    view.rerender(modal({ podName: 'pod-a' }));
    await waitFor(() =>
      expect(bridge.api.getLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ podName: 'pod-a' })
      )
    );
    expect(followButton()).toHaveAttribute('aria-pressed', 'false');
    expect(bridge.api.logStreamStart).toHaveBeenCalledTimes(1);
  });

  it('stops a stream that starts after the viewer already closed', async () => {
    const bridge = streamingApi();
    let resolveStart!: (value: {
      success: true;
      data: { streamId: string };
    }) => void;
    bridge.api.logStreamStart.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStart = resolve;
        })
    );
    const view = render(modal(), { api: bridge.api });
    await waitFor(() => expect(content()).toHaveTextContent('snapshot line'));
    fireEvent.click(followButton());
    expect(status()).toHaveTextContent('Connecting');

    view.rerender(modal({ isOpen: false }));
    await act(async () => {
      resolveStart({ success: true, data: { streamId: 'late-stream' } });
    });

    expect(bridge.api.logStreamStop).toHaveBeenCalledWith('late-stream');
  });

  it('ignores a snapshot that arrives after Follow was turned on', async () => {
    const bridge = streamingApi();
    let resolveSnapshot!: (value: { success: true; data: string }) => void;
    bridge.api.getLogs.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSnapshot = resolve;
        })
    );
    render(modal(), { api: bridge.api });
    fireEvent.click(followButton());
    await waitFor(() => expect(status()).toHaveTextContent('Live'));
    bridge.emitLines('stream-1', ['streamed']);

    await act(async () => {
      resolveSnapshot({ success: true, data: 'stale snapshot' });
    });

    expect(content().textContent).toBe('streamed');
  });

  it('turning Follow on switches auto-refresh off', async () => {
    const bridge = streamingApi();
    render(modal(), { api: bridge.api });
    await waitFor(() => expect(content()).toHaveTextContent('snapshot line'));
    fireEvent.click(screen.getByRole('button', { name: /auto-refresh/i }));

    fireEvent.click(followButton());
    await waitFor(() => expect(status()).toHaveTextContent('Live'));
    fireEvent.click(followButton());

    expect(
      screen.getByRole('button', { name: /auto-refresh/i })
    ).not.toHaveClass('active');
  });

  describe('auto-scroll', () => {
    /** Gives the log pane a scroll geometry jsdom does not compute. */
    function scrollable(el: HTMLElement) {
      const box = { top: 0, height: 1000 };
      Object.defineProperty(el, 'clientHeight', {
        configurable: true,
        get: () => 200,
      });
      Object.defineProperty(el, 'scrollHeight', {
        configurable: true,
        get: () => box.height,
      });
      Object.defineProperty(el, 'scrollTop', {
        configurable: true,
        get: () => box.top,
        set: (v: number) => {
          box.top = v;
        },
      });
      return box;
    }

    it('follows new lines while at the bottom and pauses when scrolled up', async () => {
      const bridge = streamingApi();
      await startFollowing(bridge);
      const box = scrollable(content());

      box.height = 1200;
      bridge.emitLines('stream-1', ['a']);
      expect(box.top).toBe(1200);
      expect(screen.queryByText(/auto-scroll paused/i)).toBeNull();

      // The user scrolls up to read.
      box.top = 300;
      fireEvent.scroll(content());
      const jump = await screen.findByRole('button', {
        name: /auto-scroll paused/i,
      });

      box.height = 1400;
      bridge.emitLines('stream-1', ['b']);
      expect(box.top).toBe(300);

      fireEvent.click(jump);
      expect(box.top).toBe(1400);
      expect(screen.queryByText(/auto-scroll paused/i)).toBeNull();

      // Scrolling back to the bottom by hand resumes too.
      box.top = 100;
      fireEvent.scroll(content());
      await screen.findByText(/auto-scroll paused/i);
      box.top = 1400 - 200;
      fireEvent.scroll(content());
      await waitFor(() =>
        expect(screen.queryByText(/auto-scroll paused/i)).toBeNull()
      );
    });
  });
});
