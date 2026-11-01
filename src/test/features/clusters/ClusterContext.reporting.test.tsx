import { describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { ApiProvider } from '../../../services/api-context';
import {
  ClusterProvider,
  useClusterContext,
} from '../../../features/clusters/ClusterContext';
import { createMockElectronAPI } from '../../utils/mocks';
import { mockToast } from '../../mocks/toast-mock';

/**
 * Which cluster-list failures the provider reports with a toast: a missing
 * kubectl already has its own notice on the pages, everything else is
 * toasted, and a context read that throws is reported too.
 */

describe('ClusterProvider error reporting', () => {
  let api: ReturnType<typeof createMockElectronAPI>;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider api={api}>
      <ClusterProvider>{children}</ClusterProvider>
    </ApiProvider>
  );
  const renderContext = () =>
    renderHook(() => useClusterContext(), { wrapper });

  beforeEach(() => {
    api = createMockElectronAPI();
  });

  it('reports a cluster list that cannot be read', async () => {
    api.getClusters.mockResolvedValue({
      success: false,
      error: 'The kubeconfig file is not valid YAML',
    });

    const { result } = renderContext();

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to fetch clusters',
        expect.objectContaining({
          description: 'The kubeconfig file is not valid YAML',
        })
      )
    );
    expect(result.current.clusters).toEqual([]);
  });

  it('leaves a missing kubectl to the page notice', async () => {
    api.getClusters.mockResolvedValue({
      success: false,
      error: 'kubectl is not installed or not on the PATH',
    });

    const { result } = renderContext();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.getClusters).toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalledWith(
      'Failed to fetch clusters',
      expect.anything()
    );
  });

  it('reports a current-context read that throws', async () => {
    api.getCurrentContext.mockRejectedValue(new Error('bridge down'));

    const { result } = renderContext();

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to read the current context',
        expect.objectContaining({ description: 'bridge down' })
      )
    );
    expect(result.current.currentContext).toBe('');
  });
});
