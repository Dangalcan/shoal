import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';
import { registerMarketplaceIpcHandlers } from '../ipc/marketplace-ipc';
import { marketplaceService } from '../services/marketplace/marketplace-service';
import { MARKETPLACE_DISABLED_MESSAGE } from '../utils/env-utils';

vi.mock('../logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('electron', () => ({
  app: { isPackaged: false },
  ipcMain: { handle: vi.fn() },
}));

vi.mock('../services/marketplace/marketplace-service', () => ({
  marketplaceService: {
    getMarketplacePlugins: vi.fn(),
    installPlugin: vi.fn(),
    createCheckout: vi.fn(),
    getCheckoutStatus: vi.fn(),
  },
}));

type IpcHandler = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

const mockEvent = {} as IpcMainInvokeEvent;

function getHandler(channel: string): IpcHandler {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as IpcHandler;
}

const CHANNELS: Array<[string, keyof typeof marketplaceService, unknown[]]> = [
  ['get-marketplace-plugins', 'getMarketplacePlugins', []],
  ['install-plugin', 'installPlugin', ['resource-monitor']],
  ['create-checkout', 'createCheckout', ['resource-monitor']],
  ['get-checkout-status', 'getCheckoutStatus', ['cs_test_123']],
];

describe('marketplace IPC handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerMarketplaceIpcHandlers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(CHANNELS)(
    '%s is refused while the marketplace is disabled',
    async (channel, method, args) => {
      vi.stubEnv('MARKETPLACE_ENABLED', '');

      const result = await getHandler(channel)(mockEvent, ...args);

      expect(result).toEqual({
        success: false,
        error: MARKETPLACE_DISABLED_MESSAGE,
      });
      expect(marketplaceService[method]).not.toHaveBeenCalled();
    }
  );

  it.each(CHANNELS)(
    '%s reaches the service when the marketplace is enabled',
    async (channel, method, args) => {
      vi.stubEnv('MARKETPLACE_ENABLED', 'true');
      vi.mocked(marketplaceService[method]).mockResolvedValue({
        success: true,
        data: 'ok',
      } as never);

      const result = await getHandler(channel)(mockEvent, ...args);

      expect(result).toEqual({ success: true, data: 'ok' });
      expect(marketplaceService[method]).toHaveBeenCalledWith(...args);
    }
  );
});
