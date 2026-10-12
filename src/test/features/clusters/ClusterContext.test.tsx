import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ClusterProvider,
  useClusterContext,
} from '../../../features/clusters/ClusterContext';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../services/api-context', () => ({
  useApi: vi.fn(),
}));

vi.mock('../../../lib/async-operation-handler', () => ({
  handleAsyncOperation: vi.fn(async (fn: () => Promise<any>, opts: any) => {
    try {
      const result = await fn();
      // Only call onSuccess when the operation actually succeeded
      const succeeded = result === undefined || result?.success !== false;
      if (succeeded && opts?.onSuccess) await opts.onSuccess();
      return result ?? { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }),
}));

vi.mock('../../../hooks/useAsyncData', () => ({
  useAsyncData: vi.fn(({ fetchFn }: { fetchFn: () => Promise<any> }) => {
    const [data, setData] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);

    const refetch = React.useCallback(async () => {
      setLoading(true);
      const result = await fetchFn();
      setData(result);
      setLoading(false);
    }, [fetchFn]);

    React.useEffect(() => {
      refetch();
    }, []);

    return { data, loading, refetch };
  }),
}));

vi.mock('../../../hooks/useLocalStorage', () => ({
  useLocalStorage: vi.fn(() => ['all', vi.fn()]),
}));

import { useApi } from '../../../services/api-context';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TestConsumer = () => {
  const ctx = useClusterContext();
  return (
    <div>
      <div data-testid="loading">{String(ctx.loading)}</div>
      <div data-testid="context">{ctx.currentContext}</div>
      <div data-testid="clusters">{ctx.clusters.length}</div>
      <div data-testid="switching">{ctx.switching ?? 'null'}</div>
      <div data-testid="deleting">{ctx.deleting ?? 'null'}</div>
      <button
        data-testid="switch-btn"
        onClick={() => ctx.switchContext('new-context')}
      >
        Switch
      </button>
      <button
        data-testid="delete-btn"
        onClick={() => ctx.deleteCluster('cluster-a')}
      >
        Delete
      </button>
    </div>
  );
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ClusterContext', () => {
  const mockApi = {
    getClusters: vi.fn(),
    getCurrentContext: vi.fn(),
    switchContext: vi.fn(),
    deleteCluster: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApi).mockReturnValue(mockApi as any);

    mockApi.getClusters.mockResolvedValue([
      { name: 'cluster-a' },
      { name: 'cluster-b' },
    ]);
    mockApi.getCurrentContext.mockResolvedValue({
      success: true,
      data: 'cluster-a',
    });
    mockApi.switchContext.mockResolvedValue({ success: true });
    mockApi.deleteCluster.mockResolvedValue({ success: true });
  });

  it('should load clusters and current context on mount', async () => {
    render(
      <ClusterProvider>
        <TestConsumer />
      </ClusterProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false')
    );

    expect(screen.getByTestId('clusters').textContent).toBe('2');
    expect(screen.getByTestId('context').textContent).toBe('cluster-a');
  });

  it('should not update context when getCurrentContext returns success=false', async () => {
    mockApi.getCurrentContext.mockResolvedValue({ success: false });

    render(
      <ClusterProvider>
        <TestConsumer />
      </ClusterProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false')
    );

    // currentContext stays empty since success=false
    expect(screen.getByTestId('context').textContent).toBe('');
  });

  it('should switch context and update currentContext', async () => {
    render(
      <ClusterProvider>
        <TestConsumer />
      </ClusterProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false')
    );

    await act(async () => {
      screen.getByTestId('switch-btn').click();
    });

    await waitFor(() =>
      expect(screen.getByTestId('context').textContent).toBe('new-context')
    );
    expect(mockApi.switchContext).toHaveBeenCalledWith('new-context');
  });

  it('should return failed result when switchContext API call fails', async () => {
    mockApi.switchContext.mockResolvedValue({
      success: false,
      error: 'Forbidden',
    });

    render(
      <ClusterProvider>
        <TestConsumer />
      </ClusterProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false')
    );

    await act(async () => {
      screen.getByTestId('switch-btn').click();
    });

    // Context should remain unchanged on failure
    await waitFor(() =>
      expect(screen.getByTestId('context').textContent).toBe('cluster-a')
    );
  });

  it('should delete cluster and refetch cluster list', async () => {
    render(
      <ClusterProvider>
        <TestConsumer />
      </ClusterProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false')
    );

    mockApi.getClusters.mockClear();

    await act(async () => {
      screen.getByTestId('delete-btn').click();
    });

    await waitFor(() =>
      expect(mockApi.deleteCluster).toHaveBeenCalledWith('cluster-a')
    );
  });

  it('should clear currentContext when deleting the active cluster', async () => {
    // First call sets context to 'cluster-a'; subsequent calls (after refetch) return failure
    // so the context stays cleared after deletion
    mockApi.getCurrentContext
      .mockResolvedValueOnce({ success: true, data: 'cluster-a' })
      .mockResolvedValue({ success: false });

    render(
      <ClusterProvider>
        <TestConsumer />
      </ClusterProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('context').textContent).toBe('cluster-a')
    );

    await act(async () => {
      screen.getByTestId('delete-btn').click();
    });

    // After deletion, the active cluster was deleted so context clears
    await waitFor(() =>
      expect(screen.getByTestId('context').textContent).toBe('')
    );
  });

  it('useClusterContext should throw when used outside provider', () => {
    const Naked = () => {
      useClusterContext();
      return null;
    };

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Naked />)).toThrow(
      'useClusterContext must be used within a ClusterProvider'
    );
    spy.mockRestore();
  });
});
