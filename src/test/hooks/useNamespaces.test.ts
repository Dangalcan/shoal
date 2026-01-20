import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '../utils';
import { useNamespaces } from '../../hooks/useNamespaces';
import { mockElectronAPI } from '../setup';

describe('useNamespaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty namespaces initially', () => {
    const { result } = renderHook(() => useNamespaces('test-context'));
    expect(result.current.namespaces).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  it('should fetch namespaces on mount', async () => {
    mockElectronAPI.getNamespaces.mockResolvedValue({
      success: true,
      data: ['default', 'kube-system'],
    });

    const { result } = renderHook(() => useNamespaces('test-context'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.namespaces).toEqual([
      'all',
      'default',
      'kube-system',
    ]);
    expect(result.current.error).toBeNull();
  });

  it('should handle error during fetch', async () => {
    mockElectronAPI.getNamespaces.mockResolvedValue({
      success: false,
      error: 'Failed to fetch',
    });

    const { result } = renderHook(() => useNamespaces('test-context'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.namespaces).toEqual([]);
    expect(result.current.error).toBe('Failed to fetch');
  });

  it('should not fetch if contextName is undefined', async () => {
    const { result } = renderHook(() => useNamespaces(undefined));

    // Should verify it didn't call API
    // Wait a tick to ensure effect runs
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockElectronAPI.getNamespaces).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  // Re-writing the update test properly with act
  it('should allow setting selected namespace', async () => {
    mockElectronAPI.getNamespaces.mockResolvedValue({
      success: true,
      data: [],
    });
    const { result } = renderHook(() => useNamespaces('ctx'));

    // Wait for init load
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Update
    const { act } = await import('@testing-library/react');

    act(() => {
      result.current.setSelectedNamespace('custom-ns');
    });

    expect(result.current.selectedNamespace).toBe('custom-ns');
  });
});
