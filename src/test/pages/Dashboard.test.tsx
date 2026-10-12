import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dashboard } from '../../pages/Dashboard';
import { render, screen, fireEvent, waitFor } from '../utils';
import { createMockElectronAPI } from '../utils/mocks';
import { mockClusterState, mockToolStatus } from '../helpers/electron-helpers';
import {
  expectMultipleOccurrences,
  findByTextWithTimeout,
} from '../helpers/dom-helpers';
import { TEST_TIMEOUTS } from '../constants';

import '../mocks/modal-mocks';

let mockApi: ReturnType<typeof createMockElectronAPI>;

describe('Dashboard Page', () => {
  beforeEach(() => {
    mockApi = createMockElectronAPI();
    vi.clearAllMocks();
    // Default happy path
    mockClusterState([], 'None', mockApi);
    mockToolStatus({}, mockApi);
  });

  it('should render dashboard header', async () => {
    render(<Dashboard />, { api: mockApi });
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(
        screen.getByText('Overview of your container infrastructure.')
      ).toBeInTheDocument();
    });
  });

  it('should fetch and display tool status (Docker/Podman)', async () => {
    mockToolStatus({ docker: true, podman: false }, mockApi);

    render(<Dashboard />, { api: mockApi });

    await waitFor(() => {
      expect(screen.getByText('Docker Status')).toBeInTheDocument();
      expect(mockApi.getToolStatus).toHaveBeenCalledWith('docker');
      expect(mockApi.getToolStatus).toHaveBeenCalledWith('podman');
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('Not installed')).toBeInTheDocument();
    });
  });

  it('should say Stopped when the engine is installed but its daemon is down', async () => {
    mockToolStatus({ docker: 'stopped', podman: false }, mockApi);

    render(<Dashboard />, { api: mockApi });

    expect(await screen.findByText('Stopped')).toBeInTheDocument();
  });

  it('should explain how to install kubectl when it is missing', async () => {
    mockToolStatus({ kubectl: false }, mockApi);

    render(<Dashboard />, { api: mockApi });

    expect(await screen.findByText('kubectl not found')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Install instructions'));
    expect(mockApi.openExternal).toHaveBeenCalledWith(
      'https://kubernetes.io/docs/tasks/tools/'
    );
  });

  it('should not show the kubectl notice when kubectl is installed', async () => {
    render(<Dashboard />, { api: mockApi });

    await waitFor(() =>
      expect(mockApi.getToolStatus).toHaveBeenCalledWith('kubectl')
    );
    expect(screen.queryByText('kubectl not found')).toBeNull();
  });

  it('should fetch and display cluster stats', async () => {
    mockClusterState(['c1', 'c2'], 'c1', mockApi);

    render(<Dashboard />, { api: mockApi });

    await findByTextWithTimeout('Active Context');
    await expectMultipleOccurrences('c1', 1);
    await findByTextWithTimeout('Total Clusters');
    await findByTextWithTimeout('2');
  });

  // ... (create cluster test)

  it('should render cluster list with active/available badges', async () => {
    mockClusterState(
      ['active-cluster', 'other-cluster'],
      'active-cluster',
      mockApi
    );

    render(<Dashboard />, { api: mockApi });

    await expectMultipleOccurrences('active-cluster', 1);
    await findByTextWithTimeout('other-cluster');

    const listItems = await screen.findAllByRole('listitem');
    const activeRow = listItems.find((li) =>
      li.textContent?.includes('active-cluster')
    );
    expect(activeRow).toBeDefined();
    expect(activeRow).toHaveTextContent(/Active/i);

    await findByTextWithTimeout('Active');
    await findByTextWithTimeout('Available');
  });

  it('should navigate to cluster details', async () => {
    mockClusterState(['nav-cluster'], 'None', mockApi);
    render(<Dashboard />, { api: mockApi });
    await findByTextWithTimeout('nav-cluster');

    const clusterContent = screen
      .getByText('nav-cluster')
      .closest('.cluster-item-content')!;
    fireEvent.click(clusterContent);
  });

  it('should open pod viewer modal', async () => {
    mockClusterState(['view-cluster'], 'view-cluster', mockApi);

    render(<Dashboard />, { api: mockApi });
    await expectMultipleOccurrences('view-cluster', 1);

    const viewBtn = screen.getByTitle('View Pods');
    expect(viewBtn).toBeInTheDocument();
    fireEvent.click(viewBtn);

    expect(
      await screen.findByTestId(
        'pod-modal',
        {},
        { timeout: TEST_TIMEOUTS.NETWORK_REQUEST }
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Pods in view-cluster/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close'));
    await waitFor(() =>
      expect(screen.queryByTestId('pod-modal')).not.toBeInTheDocument()
    );
  });

  it('should refresh data on button click', async () => {
    render(<Dashboard />, { api: mockApi });

    await waitFor(() => expect(mockApi.getClusters).toHaveBeenCalledTimes(1));

    const rBtn = screen.getByTitle('Refresh Data');

    fireEvent.click(rBtn);
    await waitFor(() => expect(mockApi.getClusters).toHaveBeenCalledTimes(2));
  });

  it('should handle empty clusters list', async () => {
    mockClusterState([], 'None', mockApi);
    render(<Dashboard />, { api: mockApi });

    await waitFor(() => {
      expect(screen.getByText('No clusters found')).toBeInTheDocument();
    });
  });

  it('should handle tool status check failure (graceful degradation)', async () => {
    mockApi.getToolStatus = vi
      .fn()
      .mockRejectedValue(new Error('Tool check failed'));

    render(<Dashboard />, { api: mockApi });

    expect(await screen.findAllByText('Not installed')).toHaveLength(2);
  });
});
