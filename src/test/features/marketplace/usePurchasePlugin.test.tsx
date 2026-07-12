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
    info: vi.fn(),
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

  it('reports a distinct timeout when payment never completes in the poll budget', async () => {
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
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Payment was not confirmed'),
      expect.anything()
    );
    expect(result.current.purchasing).toBe(false);
  });

  it('cancelPurchase stops polling and shows a cancelled notice, not an error', async () => {
    api.createCheckout.mockResolvedValue({
      success: true,
      data: { sessionId: 'cs_4', url: 'https://pay.test/cs_4' },
    });
    let polls = 0;
    const { result } = renderHook(() =>
      usePurchasePlugin('paid-plugin', 'Paid', { pollIntervalMs: 0, maxPolls: 50 })
    );
    api.getCheckoutStatus.mockImplementation(async () => {
      polls++;
      // Cancel while the payment page is "open" and polling is underway.
      if (polls === 2) result.current.cancelPurchase();
      return { success: true, data: { status: 'pending' } };
    });

    await act(async () => {
      await result.current.handlePurchase();
    });

    expect(polls).toBeLessThan(50);
    expect(activateLicense).not.toHaveBeenCalled();
    expect(installPlugin).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining('cancelled'),
      expect.anything()
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(result.current.purchasing).toBe(false);
  });

  it('a new purchase after a cancel starts with a fresh cancel flag', async () => {
    api.createCheckout.mockResolvedValue({
      success: true,
      data: { sessionId: 'cs_5', url: 'https://pay.test/cs_5' },
    });
    api.getCheckoutStatus.mockResolvedValue({
      success: true,
      data: { status: 'paid', licenseKey: 'LIC-5' },
    });

    const { result } = renderHook(() =>
      usePurchasePlugin('paid-plugin', 'Paid', { pollIntervalMs: 0 })
    );

    // Cancel before any purchase, then purchase: must still complete.
    act(() => result.current.cancelPurchase());
    await act(async () => {
      await result.current.handlePurchase();
    });

    expect(activateLicense).toHaveBeenCalledWith('paid-plugin', 'LIC-5');
    expect(toast.success).toHaveBeenCalled();
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
