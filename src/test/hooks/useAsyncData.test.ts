import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { handleError } from '../../lib/error-handler';

vi.mock('../../lib/error-handler', () => ({ handleError: vi.fn() }));

const mockedHandleError = vi.mocked(handleError);

describe('useAsyncData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('skips the initial fetch when skipInitialFetch is set', async () => {
    const fetchFn = vi.fn().mockResolvedValue(1);
    const { result } = renderHook(() =>
      useAsyncData({ fetchFn, skipInitialFetch: true })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it('stores data from a successful Result', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ success: true, data: [1, 2] });
    const { result } = renderHook(() => useAsyncData({ fetchFn }));
    await waitFor(() => expect(result.current.data).toEqual([1, 2]));
    expect(result.current.error).toBeNull();
  });

  it('stores a plain (non-Result) value directly', async () => {
    const fetchFn = vi.fn().mockResolvedValue('plain');
    const { result } = renderHook(() => useAsyncData({ fetchFn }));
    await waitFor(() => expect(result.current.data).toBe('plain'));
  });

  it('sets error and reports via handleError on a failed Result with a title', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ success: false, error: 'bad' });
    const { result } = renderHook(() =>
      useAsyncData({ fetchFn, errorTitle: 'Load Failed' })
    );
    await waitFor(() => expect(result.current.error).toBe('bad'));
    expect(result.current.data).toBeNull();
    expect(mockedHandleError).toHaveBeenCalledWith(
      expect.any(Error),
      'Load Failed',
      expect.objectContaining({ id: expect.any(String) })
    );
  });

  it('reports the same failure once until it changes or the fetch recovers', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: 'down' })
      .mockResolvedValueOnce({ success: false, error: 'down' })
      .mockResolvedValueOnce({ success: false, error: 'other' })
      .mockResolvedValueOnce({ success: true, data: 'ok' })
      .mockResolvedValueOnce({ success: false, error: 'down' });
    const { result } = renderHook(() =>
      useAsyncData({ fetchFn, errorTitle: 'Load Failed' })
    );
    await waitFor(() => expect(result.current.error).toBe('down'));
    await result.current.refetch(); // same error: no new toast
    await result.current.refetch(); // different error: toast
    await result.current.refetch(); // recovers
    await result.current.refetch(); // fails again: toast

    expect(mockedHandleError).toHaveBeenCalledTimes(3);
    const ids = mockedHandleError.mock.calls.map((c) => c[2]?.id);
    expect(new Set(ids).size).toBe(1);
  });

  it('sets error without reporting when no title is given', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ success: false, error: 'bad' });
    const { result } = renderHook(() => useAsyncData({ fetchFn }));
    await waitFor(() => expect(result.current.error).toBe('bad'));
    expect(mockedHandleError).not.toHaveBeenCalled();
  });

  it('handles a thrown Error and reports it when a title is given', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('kaboom'));
    const { result } = renderHook(() =>
      useAsyncData({ fetchFn, errorTitle: 'Oops' })
    );
    await waitFor(() => expect(result.current.error).toBe('kaboom'));
    expect(mockedHandleError).toHaveBeenCalledWith(
      expect.any(Error),
      'Oops',
      expect.objectContaining({ id: expect.any(String) })
    );
  });

  it('uses a generic message for a non-Error throw', async () => {
    const fetchFn = vi.fn().mockRejectedValue('string failure');
    const { result } = renderHook(() => useAsyncData({ fetchFn }));
    await waitFor(() => expect(result.current.error).toBe('An error occurred'));
  });

  it('refetches on demand', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ success: true, data: 'a' });
    const { result } = renderHook(() => useAsyncData({ fetchFn }));
    await waitFor(() => expect(result.current.data).toBe('a'));
    fetchFn.mockResolvedValue({ success: true, data: 'b' });
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data).toBe('b');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  describe('auto-refresh', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('refetches on the auto-refresh interval', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ success: true, data: 1 });
      renderHook(() => useAsyncData({ fetchFn, autoRefreshInterval: 1000 }));
      // initial fetch
      await vi.advanceTimersByTimeAsync(0);
      const initial = fetchFn.mock.calls.length;
      await vi.advanceTimersByTimeAsync(1000);
      expect(fetchFn.mock.calls.length).toBeGreaterThan(initial);
    });
  });
});
