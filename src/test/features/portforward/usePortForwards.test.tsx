import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createMockElectronAPI } from '../../utils/mocks';
import { mockToast } from '../../mocks/toast-mock';
import { ApiProvider } from '../../../services/api-context';
import { usePortForwards } from '../../../features/portforward/usePortForwards';
import type { PortForwardInfo } from '../../../types';

/**
 * The port-forward manager hook: the list, the closed-tunnel warning with
 * its refresh, and the start and stop operations with their toasts.
 */

const forward: PortForwardInfo = {
  id: 'pf-1',
  contextName: 'kind-dev',
  namespace: 'default',
  resourceType: 'service',
  resourceName: 'web',
  localPort: 8080,
  remotePort: 80,
  startedAt: '2026-10-16T10:00:00.000Z',
};

type ClosedListener = (info: PortForwardInfo, error?: string) => void;

describe('usePortForwards', () => {
  let api: ReturnType<typeof createMockElectronAPI>;
  let onClosed: ClosedListener | null;
  const unsubscribe = vi.fn();

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider api={api}>{children}</ApiProvider>
  );

  beforeEach(() => {
    onClosed = null;
    unsubscribe.mockClear();
    api = createMockElectronAPI({
      portForwardList: vi
        .fn()
        .mockResolvedValue({ success: true, data: [forward] }),
      onPortForwardClosed: vi.fn((listener: ClosedListener) => {
        onClosed = listener;
        return unsubscribe;
      }),
    });
  });

  it('lists the active forwards and stops listening on unmount', async () => {
    const { result, unmount } = renderHook(() => usePortForwards(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.forwards).toEqual([forward]));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('warns and refreshes when a tunnel closes in the backend', async () => {
    const { result } = renderHook(() => usePortForwards(), { wrapper });
    await waitFor(() => expect(result.current.forwards).toHaveLength(1));
    api.portForwardList.mockClear();

    act(() => onClosed!(forward, 'pod deleted'));

    expect(mockToast.warning).toHaveBeenCalledWith(
      'Port forward service/web (localhost:8080) closed: pod deleted'
    );
    await waitFor(() => expect(api.portForwardList).toHaveBeenCalled());

    act(() => onClosed!(forward));
    expect(mockToast.warning).toHaveBeenLastCalledWith(
      'Port forward service/web (localhost:8080) closed'
    );
  });

  it('starts a forward and refreshes the list', async () => {
    const { result } = renderHook(() => usePortForwards(), { wrapper });
    await waitFor(() => expect(result.current.forwards).toHaveLength(1));
    api.portForwardList.mockClear();

    const { id: _id, startedAt: _startedAt, ...args } = forward;
    let outcome: { success: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.startForward(args);
    });

    expect(outcome).toEqual({ success: true });
    expect(api.portForwardStart).toHaveBeenCalledWith(args);
    await waitFor(() => expect(api.portForwardList).toHaveBeenCalled());
  });

  it('reports a forward that could not start', async () => {
    api.portForwardStart.mockResolvedValue({
      success: false,
      error: 'port 8080 is in use',
    });
    const { result } = renderHook(() => usePortForwards(), { wrapper });
    await waitFor(() => expect(result.current.forwards).toHaveLength(1));

    const { id: _id, startedAt: _startedAt, ...args } = forward;
    let outcome: { success: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.startForward(args);
    });

    expect(outcome).toEqual({ success: false });
    expect(mockToast.error).toHaveBeenCalled();
  });

  it('stops a forward by id and refreshes the list', async () => {
    const { result } = renderHook(() => usePortForwards(), { wrapper });
    await waitFor(() => expect(result.current.forwards).toHaveLength(1));
    api.portForwardList.mockClear();

    let outcome: { success: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.stopForward(forward);
    });

    expect(outcome).toEqual({ success: true });
    expect(api.portForwardStop).toHaveBeenCalledWith('pf-1');
    await waitFor(() => expect(api.portForwardList).toHaveBeenCalled());
  });
});
