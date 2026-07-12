import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain, app } from 'electron';
import { registerPortForwardIpcHandlers } from '../ipc/portforward-ipc';
import { portForwardService } from '../services/portforward/portforward-service';

vi.mock('../logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    on: vi.fn(),
  },
}));

vi.mock('../services/portforward/portforward-service', () => ({
  portForwardService: {
    startForward: vi.fn(),
    stopForward: vi.fn(),
    listForwards: vi.fn(),
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

const forwardInfo = {
  id: 'fwd-1',
  contextName: 'kind-test',
  namespace: 'default',
  resourceType: 'pod' as const,
  resourceName: 'my-pod',
  localPort: 8080,
  remotePort: 80,
  startedAt: '2026-01-01T00:00:00.000Z',
};

describe('portforward-ipc', () => {
  const send = vi.fn();
  const mockEvent = {
    sender: { isDestroyed: () => false, send },
  } as unknown as IpcMainInvokeEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    registerPortForwardIpcHandlers();
  });

  it('portforward:start delegates to the service and returns the info', async () => {
    vi.mocked(portForwardService.startForward).mockResolvedValue(forwardInfo);

    const args = {
      contextName: 'kind-test',
      namespace: 'default',
      resourceType: 'pod',
      resourceName: 'my-pod',
      localPort: 8080,
      remotePort: 80,
    };
    const result = await getHandler('portforward:start')(mockEvent, args);

    expect(result).toEqual({ success: true, data: forwardInfo });
    expect(portForwardService.startForward).toHaveBeenCalledWith(
      args,
      expect.any(Function)
    );
  });

  it('portforward:start forwards close events to the renderer', async () => {
    vi.mocked(portForwardService.startForward).mockResolvedValue(forwardInfo);

    await getHandler('portforward:start')(mockEvent, {});
    const onClosed = vi.mocked(portForwardService.startForward).mock
      .calls[0]![1]!;
    onClosed(forwardInfo, 'lost connection');

    expect(send).toHaveBeenCalledWith('portforward:closed', {
      info: forwardInfo,
      error: 'lost connection',
    });
  });

  it('portforward:start returns the service error', async () => {
    vi.mocked(portForwardService.startForward).mockRejectedValue(
      new Error('Local port 8080 is already forwarded')
    );

    const result = await getHandler('portforward:start')(mockEvent, {});

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already forwarded/);
  });

  it('portforward:stop delegates to the service', async () => {
    vi.mocked(portForwardService.stopForward).mockReturnValue(true);

    const result = await getHandler('portforward:stop')(mockEvent, {
      id: 'fwd-1',
    });

    expect(result).toEqual({ success: true, data: true });
    expect(portForwardService.stopForward).toHaveBeenCalledWith('fwd-1');
  });

  it('portforward:list returns the active forwards', async () => {
    vi.mocked(portForwardService.listForwards).mockReturnValue([forwardInfo]);

    const result = await getHandler('portforward:list')(mockEvent);

    expect(result).toEqual({ success: true, data: [forwardInfo] });
  });

  it('stops all forwards on app quit', () => {
    // app.on is overloaded; widen the mocked call tuples so the channel
    // comparison isn't narrowed to the first overload's literal type.
    const calls = vi.mocked(app.on).mock.calls as unknown as Array<
      [string, () => void]
    >;
    const quitCall = calls.find(([name]) => name === 'will-quit');
    expect(quitCall).toBeTruthy();

    quitCall![1]();
    expect(portForwardService.stopAll).toHaveBeenCalled();
  });
});
