import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils';
import { createMockElectronAPI } from '../utils/mocks';
import { Layout } from '../../layouts/Layout';
import { Dashboard } from '../../pages/Dashboard';
import { CreateCluster } from '../../pages/CreateCluster';
import { Clusters } from '../../pages/Clusters';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { deleteClusterViaUI } from '../helpers/cluster-test-utils';

let mockApi: ReturnType<typeof createMockElectronAPI>;

describe('Cluster Lifecycle Integration', () => {
  // Increase timeout for integration tests as they involve multiple steps and animations
  vi.setConfig({ testTimeout: 10000 });

  beforeEach(() => {
    mockApi = createMockElectronAPI();
    vi.clearAllMocks();

    // Default mocks for standard environment
    mockApi.getCurrentContext = vi
      .fn()
      .mockResolvedValue({ success: true, data: 'None' });
    mockApi.getClusters = vi
      .fn()
      .mockResolvedValue({ success: true, data: [] });
  });

  const AppRoutes = () => (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="create-cluster" element={<CreateCluster />} />
        <Route path="clusters" element={<Clusters />} />
      </Route>
    </Routes>
  );

  it('should flow from Dashboard to Create Cluster to Clusters List and Delete', async () => {
    const user = userEvent.setup();

    render(<AppRoutes />, { initialEntries: ['/'], api: mockApi });

    // 1. Dashboard: Should be empty initially
    expect(
      screen.getByRole('heading', { name: 'Dashboard' })
    ).toBeInTheDocument();
    expect(screen.getByText('No clusters found')).toBeInTheDocument();

    // 2. Click "Create New Cluster"
    const createBtn = screen.getByRole('button', {
      name: /create new cluster/i,
    });
    await user.click(createBtn);

    // 3. CreateCluster Page: Fill and Submit
    expect(
      screen.getByRole('heading', { name: 'Create Cluster' })
    ).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText('my-cluster');
    await user.type(nameInput, 'lifecycle-test-cluster');

    // Mock success and update cluster list for next page
    mockApi.createCluster = vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined });
    mockApi.getClusters = vi
      .fn()
      .mockResolvedValue({ success: true, data: ['lifecycle-test-cluster'] });

    const submitBtn = screen.getByRole('button', { name: /Create Cluster/i });
    await user.click(submitBtn);

    // 4. Verification: Should land on Clusters page
    await waitFor(() => {
      expect(
        screen.getByText('Manage your local Kubernetes environments.')
      ).toBeInTheDocument();
      expect(screen.getByText('lifecycle-test-cluster')).toBeInTheDocument();
    });

    // 5. Deletion: Test full deletion flow
    mockApi.deleteCluster = vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined });
    // Update mock to return empty list after deletion
    mockApi.getClusters = vi
      .fn()
      .mockResolvedValue({ success: true, data: [] });

    await deleteClusterViaUI('lifecycle-test-cluster', user);

    // 6. Final verification: List should be empty
    // Increasing timeout here because deletion involves a full roundtrip of state updates
    await waitFor(
      () => {
        expect(screen.getByText('No clusters found')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(
      screen.queryByText('lifecycle-test-cluster')
    ).not.toBeInTheDocument();
  });
});
