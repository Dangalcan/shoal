import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useResourceModal } from '../../hooks/useResourceModal';
import { handleError } from '../../lib/error-handler';

vi.mock('../../lib/error-handler', () => ({ handleError: vi.fn() }));

type Fetch = () => Promise<{ success: boolean; data?: string; error?: string }>;

function renderModal(fetchFn: Fetch, resourceName = 'pod-a') {
  return renderHook(
    (props: { fetchFn: Fetch; resourceName: string }) =>
      useResourceModal({
        clusterName: 'kind-dev',
        resourceName: props.resourceName,
        fetchFn: props.fetchFn,
        errorTitle: 'Failed',
      }),
    { initialProps: { fetchFn, resourceName } }
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
    rerender({ fetchFn: second, resourceName: 'pod-b' });

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
    rerender({ fetchFn: failing, resourceName: 'pod-c' });

    await waitFor(() => expect(result.current.error).toBe('not found'));
    expect(result.current.content).toBe('');
  });

  it('ignores an answer for a resource that is no longer shown', async () => {
    let finishFirst: (v: {
      success: boolean;
      data?: string;
    }) => void = () => {};
    const slow = vi.fn(
      () =>
        new Promise<{ success: boolean; data?: string }>(
          (r) => (finishFirst = r)
        )
    );
    const { result, rerender } = renderModal(slow);
    await waitFor(() => expect(result.current.loading).toBe(true));

    const fast = vi.fn().mockResolvedValue({ success: true, data: 'b: 2' });
    rerender({ fetchFn: fast, resourceName: 'pod-b' });
    await waitFor(() => expect(result.current.content).toBe('b: 2'));

    finishFirst({ success: true, data: 'a: 1' });
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.content).toBe('b: 2');
  });

  it('shows empty content for a successful load without data', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderModal(fetchFn);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.content).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('reports a failed load without an error message as unknown', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ success: false });
    const { result } = renderModal(fetchFn);

    await waitFor(() => expect(result.current.error).toBe('Unknown error'));
    expect(result.current.loading).toBe(false);
    expect(handleError).toHaveBeenCalledWith(
      new Error('Unknown error'),
      'Failed'
    );
  });

  it('shows the message of a thrown Error', async () => {
    const boom = new Error('connection reset');
    const fetchFn = vi.fn().mockRejectedValue(boom);
    const { result } = renderModal(fetchFn);

    await waitFor(() => expect(result.current.error).toBe('connection reset'));
    expect(result.current.content).toBe('');
    expect(handleError).toHaveBeenCalledWith(boom, 'Failed');
  });

  it('shows a generic message when something other than an Error is thrown', async () => {
    const fetchFn = vi.fn().mockRejectedValue('socket closed');
    const { result } = renderModal(fetchFn);

    await waitFor(() => expect(result.current.error).toBe('An error occurred'));
    expect(handleError).toHaveBeenCalledWith('socket closed', 'Failed');
  });

  it('ignores a failure for a resource that is no longer shown', async () => {
    let failFirst: (err: Error) => void = () => {};
    const slow = vi.fn(
      () =>
        new Promise<{ success: boolean; data?: string }>(
          (_, reject) => (failFirst = reject)
        )
    );
    const { result, rerender } = renderModal(slow);
    await waitFor(() => expect(result.current.loading).toBe(true));

    const fast = vi.fn().mockResolvedValue({ success: true, data: 'b: 2' });
    rerender({ fetchFn: fast, resourceName: 'pod-b' });
    await waitFor(() => expect(result.current.content).toBe('b: 2'));

    await act(async () => {
      failFirst(new Error('late failure'));
    });
    expect(result.current.error).toBeNull();
    expect(result.current.content).toBe('b: 2');
    expect(handleError).not.toHaveBeenCalled();
  });

  describe('copyToClipboard', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('copies the content and shows the copied state for two seconds', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValue({ success: true, data: 'a: 1' });
      const { result } = renderModal(fetchFn);
      await waitFor(() => expect(result.current.content).toBe('a: 1'));

      vi.useFakeTimers();
      await act(async () => {
        result.current.copyToClipboard();
      });
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('a: 1');
      expect(result.current.copied).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1999);
      });
      expect(result.current.copied).toBe(true);
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current.copied).toBe(false);
    });

    it('reports a clipboard failure and stays uncopied', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValue({ success: true, data: 'a: 1' });
      const { result } = renderModal(fetchFn);
      await waitFor(() => expect(result.current.content).toBe('a: 1'));

      const denied = new Error('clipboard denied');
      vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(denied);
      await act(async () => {
        result.current.copyToClipboard();
      });

      expect(result.current.copied).toBe(false);
      expect(handleError).toHaveBeenCalledWith(
        denied,
        'Could not copy to the clipboard'
      );
    });
  });

  it('shows nothing and does not fetch without a resource name', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ success: true, data: 'x' });
    const { result } = renderModal(fetchFn, '');
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.content).toBe('');
  });
});
