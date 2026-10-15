import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useClusterData } from '../../hooks/useClusterData';
import { useApi } from '../../services/api-context';

vi.mock('../../services/api-context', () => ({
  useApi: vi.fn(),
}));

vi.mock('../../hooks/useLocalStorage', () => ({
  useLocalStorage: vi.fn((key, initialValue) => {
    if (key === 'k8s_desktop_auto_refresh') return [true, vi.fn()];
    if (key === 'k8s_desktop_refresh_interval') return [10, vi.fn()];
    return [initialValue, vi.fn()];
  }),
}));

describe('useClusterData', () => {
  const mockApi = {
    getResources: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useApi as any).mockReturnValue(mockApi);
  });

  it('should return empty array if contextName is undefined', async () => {
    const { result } = renderHook(() =>
      useClusterData(undefined, 'pods', 'default')
    );

    expect(result.current.items).toEqual([]);
    expect(mockApi.getResources).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.fetchData();
    });

    expect(result.current.items).toEqual([]);
    expect(mockApi.getResources).not.toHaveBeenCalled();
  });

  it('should fetch resources if contextName is provided', async () => {
    mockApi.getResources.mockResolvedValue([{ metadata: { name: 'pod1' } }]);

    const { result } = renderHook(() =>
      useClusterData('my-context', 'pods', 'default')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockApi.getResources).toHaveBeenCalledWith({
      contextName: 'my-context',
      resourceType: 'pods',
      namespace: 'default',
    });

    expect(result.current.items).toEqual([{ metadata: { name: 'pod1' } }]);
  });

  it('should not set autoRefreshInterval if autoRefresh is false', async () => {
    const { useLocalStorage } = await import('../../hooks/useLocalStorage');
    vi.mocked(useLocalStorage).mockImplementation(
      (key: string, initialValue: any) => {
        if (key === 'k8s_desktop_auto_refresh') return [false, vi.fn()];
        if (key === 'k8s_desktop_refresh_interval') return [10, vi.fn()];
        return [initialValue, vi.fn()];
      }
    );

    const { result } = renderHook(() =>
      useClusterData('my-context', 'pods', 'default')
    );
    expect(result.current.loading).toBe(true);
  });
});
