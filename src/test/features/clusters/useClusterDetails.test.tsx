import { describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ApiProvider } from '../../../services/api-context';
import { ClusterProvider } from '../../../features/clusters/ClusterContext';
import { useClusterDetails } from '../../../features/clusters/useClusterDetails';
import { createMockElectronAPI } from '../../utils/mocks';
import type { K8sResource } from '../../../types/k8s-types';

/**
 * The cluster details hook: scaling a row goes to the bridge with the row's
 * name and namespace and the active tab's kind, and a stored tab that is no
 * longer a resource kind shows no default columns.
 */

describe('useClusterDetails', () => {
  let api: ReturnType<typeof createMockElectronAPI>;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider api={api}>
      <ClusterProvider>
        <MemoryRouter initialEntries={['/cluster/kind-dev']}>
          {children}
        </MemoryRouter>
      </ClusterProvider>
    </ApiProvider>
  );
  const renderDetails = () =>
    renderHook(() => useClusterDetails('kind-dev'), { wrapper });

  beforeEach(() => {
    window.localStorage.clear();
    api = createMockElectronAPI();
  });

  it('scales a row of the active kind in its namespace', async () => {
    window.localStorage.setItem(
      'cluster-tab-kind-dev',
      JSON.stringify('deployments')
    );
    const { result } = renderDetails();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.activeTab).toBe('deployments');
    const row = { metadata: { name: 'web', namespace: 'shop' } } as K8sResource;

    await act(() => result.current.scaleItem(row, 4));

    expect(api.scaleResource).toHaveBeenCalledWith({
      contextName: 'kind-dev',
      resourceType: 'deployments',
      resourceName: 'web',
      namespace: 'shop',
      replicas: 4,
    });
  });

  it('scales a row without a namespace in the empty namespace', async () => {
    window.localStorage.setItem(
      'cluster-tab-kind-dev',
      JSON.stringify('statefulsets')
    );
    const { result } = renderDetails();
    await waitFor(() => expect(result.current.loading).toBe(false));
    const row = { metadata: { name: 'db' } } as K8sResource;

    await act(() => result.current.scaleItem(row, 0));

    expect(api.scaleResource).toHaveBeenCalledWith({
      contextName: 'kind-dev',
      resourceType: 'statefulsets',
      resourceName: 'db',
      namespace: '',
      replicas: 0,
    });
  });

  it('opens on pods when the stored tab is no longer a resource kind', async () => {
    window.localStorage.setItem(
      'k8s_desktop_visible_resources',
      JSON.stringify(['retired-kind'])
    );
    window.localStorage.setItem(
      'cluster-tab-kind-dev',
      JSON.stringify('retired-kind')
    );
    const { result } = renderDetails();
    await waitFor(() => expect(result.current.loading).toBe(false));

    // A table without columns used to be the result.
    expect(result.current.activeTab).toBe('pods');
    expect(result.current.table.visibleColumns).toEqual([
      'namespace',
      'name',
      'status',
      'restarts',
      'age',
    ]);
  });

  it('keeps CronJobs without a last schedule last in both sort directions', async () => {
    window.localStorage.setItem(
      'cluster-tab-kind-dev',
      JSON.stringify('cronjobs')
    );
    api.getResources.mockResolvedValue({
      success: true,
      data: [
        {
          metadata: { name: 'often', namespace: 'default', uid: '1' },
          status: { lastScheduleTime: '2026-11-02T17:40:00Z' },
        },
        {
          metadata: { name: 'report', namespace: 'default', uid: '2' },
          status: {},
        },
      ],
    });
    const { result } = renderDetails();
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    act(() => result.current.table.handleSort('last-schedule'));
    expect(result.current.table.sortConfig).toEqual({
      key: 'last-schedule',
      direction: 'asc',
    });
    expect(result.current.sortedItems.map((r) => r.metadata.name)).toEqual([
      'often',
      'report',
    ]);

    act(() => result.current.table.handleSort('last-schedule'));
    expect(result.current.table.sortConfig).toEqual({
      key: 'last-schedule',
      direction: 'desc',
    });
    expect(result.current.sortedItems.map((r) => r.metadata.name)).toEqual([
      'often',
      'report',
    ]);
  });
});
