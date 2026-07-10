import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { UpdateStatus } from '../../../types.d';

const h = vi.hoisted(() => {
  const state: { cb: ((s: unknown) => void) | null } = { cb: null };
  const off = vi.fn();
  const installAppUpdate = vi.fn().mockResolvedValue({ success: true });
  const toast = { info: vi.fn(), success: vi.fn() };
  const api = {
    onUpdateStatus: vi.fn((cb: (s: unknown) => void) => {
      state.cb = cb;
      return off;
    }),
    installAppUpdate,
  };
  return { state, off, installAppUpdate, toast, api };
});

vi.mock('../../../services/api-context', () => ({ useApi: () => h.api }));
vi.mock('sonner', () => ({ toast: h.toast }));

import { useAppUpdates } from '../../../features/updates/useAppUpdates';

const { api, toast, off, installAppUpdate } = h;
const fire = (s: UpdateStatus) => h.state.cb!(s);

describe('useAppUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.state.cb = null;
  });

  it('subscribes on mount and unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useAppUpdates());
    expect(api.onUpdateStatus).toHaveBeenCalledTimes(1);
    unmount();
    expect(off).toHaveBeenCalled();
  });

  it('shows an info toast when an update is downloading', () => {
    renderHook(() => useAppUpdates());
    fire({ state: 'available', version: '3.1.0' });
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('3.1.0'));
  });

  it('prompts a restart when the update is downloaded', () => {
    renderHook(() => useAppUpdates());
    fire({ state: 'downloaded', version: '3.1.0' });

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('3.1.0'),
      expect.objectContaining({
        action: expect.objectContaining({ label: 'Restart' }),
      })
    );
    // The action installs the update.
    const opts = toast.success.mock.calls[0][1] as {
      action: { onClick: () => void };
    };
    opts.action.onClick();
    expect(installAppUpdate).toHaveBeenCalled();
  });

  it('does nothing for non-actionable statuses', () => {
    renderHook(() => useAppUpdates());
    fire({ state: 'checking' });
    fire({ state: 'not-available' });
    fire({ state: 'error', message: 'x' });
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
