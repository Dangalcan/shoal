import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain, app } from 'electron';
import { registerLogsIpcHandlers } from '../ipc/logs-ipc';
import { logStreamService } from '../services/logs/log-stream-service';
import type { LogStreamCallbacks } from '../services/logs/log-stream-service';

vi.mock('../logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { on: vi.fn() },
}));

vi.mock('../services/logs/log-stream-service', () => ({
  logStreamService: {
    start: vi.fn(),
    stop: vi.fn(),
    stopOwnedBy: vi.fn(),
    stopAll: vi.fn(),
  },
}));

type IpcHandler = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

function getHandler(channel: string): IpcHandler {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as IpcHandler;
}

/** A webContents stand-in: real events, a main frame that records sends. */
class FakeSender extends EventEmitter {
  constructor(public id: number) {
    super();
  }
  destroyed = false;
  isDestroyed = vi.fn(() => this.destroyed);
  mainFrame = { send: vi.fn() };
  send = vi.fn();
}

function eventFrom(sender: FakeSender, parent: unknown = null) {
  return {
    sender,
    senderFrame: { parent },
  } as unknown as IpcMainInvokeEvent;
}

const args = {
  contextName: 'kind-test',
  podName: 'my-pod',
  namespace: 'default',
  container: 'app',
};

/** Starts a stream through the handler; returns the callbacks it registered. */
async function start(sender: FakeSender, streamId = 'stream-1') {
  vi.mocked(logStreamService.start).mockReturnValueOnce({ streamId });
  const result = await getHandler('logs:stream-start')(eventFrom(sender), args);
  const calls = vi.mocked(logStreamService.start).mock.calls;
  const callbacks = calls[calls.length - 1]![1] as LogStreamCallbacks;
  return { result, callbacks };
}

describe('logs-ipc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerLogsIpcHandlers();
  });

  it('logs:stream-start delegates to the service with the window as owner', async () => {
    const sender = new FakeSender(7);
    const { result } = await start(sender);

    expect(result).toEqual({ success: true, data: { streamId: 'stream-1' } });
    expect(logStreamService.start).toHaveBeenCalledWith(
      args,
      expect.objectContaining({
        onLines: expect.any(Function),
        onEnded: expect.any(Function),
      }),
      7
    );
  });

  it('pushes lines and the end reason to the main frame only', async () => {
    const sender = new FakeSender(1);
    const { callbacks } = await start(sender);

    callbacks.onLines(['a', 'b']);
    callbacks.onEnded({ reason: 'pod deleted', exitCode: 0 });

    expect(sender.mainFrame.send).toHaveBeenCalledWith('logs:stream-lines', {
      streamId: 'stream-1',
      lines: ['a', 'b'],
    });
    expect(sender.mainFrame.send).toHaveBeenCalledWith('logs:stream-ended', {
      streamId: 'stream-1',
      reason: 'pod deleted',
      exitCode: 0,
    });
    // Not through webContents.send's broader path.
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('stops the stream when its window is gone', async () => {
    const sender = new FakeSender(1);
    const { callbacks } = await start(sender);
    sender.destroyed = true;

    callbacks.onLines(['late']);
    callbacks.onEnded({ reason: 'x', exitCode: 0 });

    expect(sender.mainFrame.send).not.toHaveBeenCalled();
    expect(logStreamService.stop).toHaveBeenCalledWith('stream-1');
  });

  it('stops the stream when the main frame cannot be reached', async () => {
    const sender = new FakeSender(1);
    sender.mainFrame.send.mockImplementation(() => {
      throw new Error('Render frame was disposed');
    });
    const { callbacks } = await start(sender);

    callbacks.onLines(['a']);

    expect(logStreamService.stop).toHaveBeenCalledWith('stream-1');
  });

  it('returns the service error (validation, too many streams)', async () => {
    vi.mocked(logStreamService.start).mockImplementationOnce(() => {
      throw new Error('Invalid resource name: "-x"');
    });

    const result = await getHandler('logs:stream-start')(
      eventFrom(new FakeSender(1)),
      { ...args, podName: '-x' }
    );

    expect(result).toEqual({
      success: false,
      error: 'Invalid resource name: "-x"',
    });
  });

  it('refuses requests from a sub-frame', async () => {
    const result = await getHandler('logs:stream-start')(
      eventFrom(new FakeSender(1), { url: 'plugin-file://x' }),
      args
    );

    expect(result.success).toBe(false);
    expect(logStreamService.start).not.toHaveBeenCalled();
  });

  it('stops the window streams when it reloads, but not on hash routes or frames', async () => {
    const sender = new FakeSender(3);
    await start(sender);

    sender.emit('did-start-navigation', {
      isMainFrame: true,
      isSameDocument: true,
    });
    sender.emit('did-start-navigation', {
      isMainFrame: false,
      isSameDocument: false,
    });
    expect(logStreamService.stopOwnedBy).not.toHaveBeenCalled();

    vi.mocked(logStreamService.stopOwnedBy).mockReturnValueOnce(1);
    sender.emit('did-start-navigation', {
      isMainFrame: true,
      isSameDocument: false,
    });
    expect(logStreamService.stopOwnedBy).toHaveBeenCalledWith(3);
  });

  it('stops the window streams when the renderer dies or the window closes', async () => {
    const sender = new FakeSender(4);
    await start(sender);

    sender.emit('render-process-gone', {}, { reason: 'crashed' });
    sender.emit('destroyed');

    expect(logStreamService.stopOwnedBy).toHaveBeenCalledTimes(2);
    expect(logStreamService.stopOwnedBy).toHaveBeenCalledWith(4);
  });

  it('watches each window once, however many streams it starts', async () => {
    const sender = new FakeSender(5);
    await start(sender, 'stream-1');
    await start(sender, 'stream-2');

    expect(sender.listenerCount('did-start-navigation')).toBe(1);
    expect(sender.listenerCount('destroyed')).toBe(1);
  });

  it('logs:stream-stop delegates to the service', async () => {
    vi.mocked(logStreamService.stop).mockReturnValueOnce(true);

    const result = await getHandler('logs:stream-stop')(
      eventFrom(new FakeSender(1)),
      { streamId: 'stream-1' }
    );

    expect(result).toEqual({ success: true, data: true });
    expect(logStreamService.stop).toHaveBeenCalledWith('stream-1');
  });

  it('logs:stream-stop rejects a missing id', async () => {
    const result = await getHandler('logs:stream-stop')(
      eventFrom(new FakeSender(1)),
      {}
    );

    expect(result.success).toBe(false);
    expect(logStreamService.stop).not.toHaveBeenCalled();
  });

  it('stops every stream when the app quits', () => {
    // app.on is overloaded; widen the mocked call tuples so the channel
    // comparison isn't narrowed to the first overload's literal type.
    const calls = vi.mocked(app.on).mock.calls as unknown as Array<
      [string, () => void]
    >;
    const quitCall = calls.find(([name]) => name === 'will-quit');
    expect(quitCall).toBeTruthy();

    quitCall![1]();

    expect(logStreamService.stopAll).toHaveBeenCalled();
  });
});
