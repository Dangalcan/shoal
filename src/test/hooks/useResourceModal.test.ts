import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useResourceModal } from '../../hooks/useResourceModal';

vi.mock('../../lib/error-handler', () => ({ handleError: vi.fn() }));

type Fetch = () => Promise<{ success: boolean; data?: string; error?: string }>;

function renderModal(fetchFn: Fetch, isOpen = true, resourceName = 'pod-a') {
  return renderHook(
    (props: { fetchFn: Fetch; isOpen: boolean; resourceName: string }) =>
      useResourceModal({
        isOpen: props.isOpen,
        clusterName: 'kind-dev',
        resourceName: props.resourceName,
        fetchFn: props.fetchFn,
        errorTitle: 'Failed',
      }),
    { initialProps: { fetchFn, isOpen, resourceName } }
  );
}

describe('useResourceModal', () => {
  it('loads the content when opened', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ success: true, data: 'a: 1' });
    const { result } = renderModal(fetchFn);

    await waitFor(() => expect(result.current.content).toBe('a: 1'));
    expect(result.current.loading).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('clears the previous content while the next resource loads', async () => {
    const first = vi.fn().mockResolvedValue({ success: true, data: 'a: 1' });
    const { result, rerender } = renderModal(first);
    await waitFor(() => expect(result.current.content).toBe('a: 1'));

    let finish: (v: { success: boolean; data?: string }) => void = () => {};
    const second = vi.fn(
      () =>
        new Promise<{ success: boolean; data?: string }>((r) => (finish = r))
    );
    rerender({ fetchFn: second, isOpen: true, resourceName: 'pod-b' });

    // The old text must not survive into the new resource's loading state.
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.content).toBe('');

    finish({ success: true, data: 'b: 2' });
    await waitFor(() => expect(result.current.content).toBe('b: 2'));
  });

  it('keeps no stale content after a failed load', async () => {
    const first = vi.fn().mockResolvedValue({ success: true, data: 'a: 1' });
    const { result, rerender } = renderModal(first);
    await waitFor(() => expect(result.current.content).toBe('a: 1'));

    const failing = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'not found' });
    rerender({ fetchFn: failing, isOpen: true, resourceName: 'pod-c' });

    await waitFor(() => expect(result.current.error).toBe('not found'));
    expect(result.current.content).toBe('');
  });
});
