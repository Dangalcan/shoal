import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test-utils';
import { Layout } from '../../layouts/Layout';
import { Dashboard } from '../../pages/Dashboard';
import { CreateCluster } from '../../pages/CreateCluster';
import { Clusters } from '../../pages/Clusters';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { mockElectronAPI } from '../setup';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { mockClusters, deleteClusterViaUI } from '../helpers/cluster-test-utils';

describe('Cluster Lifecycle Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks for standard environment
    mockElectronAPI.checkTool.mockResolvedValue({ success: true, data: true });
    mockElectronAPI.getCurrentContext.mockResolvedValue({ success: true, data: 'None' });
    mockElectronAPI.getClusters.mockResolvedValue({ success: true, data: [] });
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
    
    render(<AppRoutes />, { initialEntries: ['/'] });

    // 1. Dashboard: Should be empty initially
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('No active clusters found')).toBeInTheDocument();
    
    // 2. Click "Create New Cluster"
    const createBtn = screen.getByRole('button', { name: /create new cluster/i });
    await user.click(createBtn);

    // 3. CreateCluster Page: Fill and Submit
    expect(screen.getByRole('heading', { name: 'Create Cluster' })).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText('my-cluster');
    await user.type(nameInput, 'lifecycle-test-cluster');
    
    // Mock success and update cluster list for next page
    mockElectronAPI.createCluster.mockResolvedValue({ success: true, data: undefined });
    mockElectronAPI.getClusters.mockResolvedValue({ success: true, data: ['lifecycle-test-cluster'] });
    
    const submitBtn = screen.getByRole('button', { name: /Create Cluster/i });
    await user.click(submitBtn);

    // 4. Verification: Should land on Clusters page
    await waitFor(() => {
      expect(screen.getByText('Manage your local Kubernetes environments.')).toBeInTheDocument();
      expect(screen.getByText('lifecycle-test-cluster')).toBeInTheDocument();
    });

    // 5. Deletion: Test full deletion flow
    mockElectronAPI.deleteCluster.mockResolvedValue({ success: true, data: undefined });
    // Update mock to return empty list after deletion
    mockElectronAPI.getClusters.mockResolvedValue({ success: true, data: [] });

    await deleteClusterViaUI('lifecycle-test-cluster');

    // 6. Final verification: List should be empty
    await waitFor(() => {
      expect(screen.getByText('No clusters found')).toBeInTheDocument();
    });
    
    expect(screen.queryByText('lifecycle-test-cluster')).not.toBeInTheDocument();
  });
});
