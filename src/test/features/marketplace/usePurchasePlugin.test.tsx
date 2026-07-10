import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const api = {
  createCheckout: vi.fn(),
  getCheckoutStatus: vi.fn(),
  openExternal: vi.fn().mockResolvedValue({ success: true, data: true }),
};
const activateLicense = vi.fn().mockResolvedValue(undefined);
const installPlugin = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../services/api-context', () => ({
  useApi: () => api,
}));
vi.mock('../../../features/plugins/PluginProvider', () => ({
  usePlugins: () => ({ activateLicense, installPlugin }),
}));
vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { usePurchasePlugin } from '../../../features/marketplace/usePurchasePlugin';
import { toast } from 'sonner';

describe('usePurchasePlugin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs checkout → open → poll → activate → install on success', async () => {
    api.createCheckout.mockResolvedValue({
      success: true,
      data: { sessionId: 'cs_1', url: 'https://pay.test/cs_1' },
    });
    api.getCheckoutStatus
      .mockResolvedValueOnce({ success: true, data: { status: 'pending' } })
      .mockResolvedValueOnce({
        success: true,
        data: { status: 'paid', licenseKey: 'LIC-XYZ' },
      });

    const { result } = renderHook(() =>
      usePurchasePlugin('paid-plugin', 'Paid', { pollIntervalMs: 0 })
    );

    await act(async () => {
      await result.current.handlePurchase();
    });

    expect(api.createCheckout).toHaveBeenCalledWith('paid-plugin');
    expect(api.openExternal).toHaveBeenCalledWith('https://pay.test/cs_1');
    expect(api.getCheckoutStatus).toHaveBeenCalledWith('cs_1');
    expect(activateLicense).toHaveBeenCalledWith('paid-plugin', 'LIC-XYZ');
    expect(installPlugin).toHaveBeenCalledWith('paid-plugin');
    expect(toast.success).toHaveBeenCalled();
    expect(result.current.purchasing).toBe(false);
  });

  it('errors and does not install when checkout creation fails', async () => {
    api.createCheckout.mockResolvedValue({
      success: false,
      error: 'Seller payouts not set up',
    });

    const { result } = renderHook(() =>
      usePurchasePlugin('paid-plugin', 'Paid', { pollIntervalMs: 0 })
    );
    await act(async () => {
      await result.current.handlePurchase();
    });

    expect(api.openExternal).not.toHaveBeenCalled();
    expect(installPlugin).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('errors if payment never completes within the poll budget', async () => {
    api.createCheckout.mockResolvedValue({
      success: true,
      data: { sessionId: 'cs_2', url: 'https://pay.test/cs_2' },
    });
    api.getCheckoutStatus.mockResolvedValue({
      success: true,
      data: { status: 'pending' },
    });

    const { result } = renderHook(() =>
      usePurchasePlugin('paid-plugin', 'Paid', { pollIntervalMs: 0, maxPolls: 3 })
    );
    await act(async () => {
      await result.current.handlePurchase();
    });

    expect(api.getCheckoutStatus).toHaveBeenCalledTimes(3);
    expect(activateLicense).not.toHaveBeenCalled();
    expect(installPlugin).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('ignores concurrent clicks while purchasing', async () => {
    api.createCheckout.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                success: true,
                data: { sessionId: 'cs_3', url: 'u' },
              }),
            5
          )
        )
    );
    api.getCheckoutStatus.mockResolvedValue({
      success: true,
      data: { status: 'paid', licenseKey: 'LIC-1' },
    });

    const { result } = renderHook(() =>
      usePurchasePlugin('p', 'P', { pollIntervalMs: 0 })
    );
    await act(async () => {
      // Fire twice without awaiting the first.
      const a = result.current.handlePurchase();
      const b = result.current.handlePurchase();
      await Promise.all([a, b]);
    });
    await waitFor(() =>
      expect(api.createCheckout).toHaveBeenCalledTimes(1)
    );
  });
});
