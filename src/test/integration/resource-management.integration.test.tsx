import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils';
import { createMockElectronAPI } from '../utils/mocks';
import { Layout } from '../../layouts/Layout';
import { ClusterDetails } from '../../pages/ClusterDetails';
import { Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {
  PodBuilder,
  DeploymentBuilder,
} from '../fixtures/builders/resource-builder';

let mockApi: ReturnType<typeof createMockElectronAPI>;

describe('Resource Management Integration', () => {
  beforeEach(() => {
    mockApi = createMockElectronAPI();
    vi.clearAllMocks();

    // Default mocks
    mockApi.checkTool = vi
      .fn()
      .mockResolvedValue({ success: true, data: true });
    mockApi.getCurrentContext = vi
      .fn()
      .mockResolvedValue({ success: true, data: 'integration-cluster' });
    mockApi.getNamespaces = vi
      .fn()
      .mockResolvedValue({ success: true, data: ['default', 'kube-system'] });
  });

  const AppRoutes = () => (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route path="cluster/:name" element={<ClusterDetails />} />
      </Route>
    </Routes>
  );

  it('should switch between pods and deployments, and perform a restart', async () => {
    const user = userEvent.setup();

    const pods = [
      new PodBuilder().withName('pod-1').withNamespace('default').build(),
    ];
    const deployments = [
      new DeploymentBuilder()
        .withName('deploy-1')
        .withNamespace('default')
        .build(),
    ];

    // Mock initial pods load
    mockApi.getResources = vi
      .fn()
      .mockImplementation(async ({ resourceType }) => {
        if (resourceType === 'pods') return { success: true, data: pods };
        if (resourceType === 'deployments')
          return { success: true, data: deployments };
        return { success: true, data: [] };
      });

    render(<AppRoutes />, {
      initialEntries: ['/cluster/integration-cluster'],
      api: mockApi,
    });

    // 1. Initial Load (Pods)
    await waitFor(() => {
      expect(screen.getByText('pod-1')).toBeInTheDocument();
    });

    // 2. Switch to Deployments
    const deploymentsTab = screen.getByRole('button', { name: /deployments/i });
    await user.click(deploymentsTab);

    // 3. Verify Deployments loaded
    await waitFor(() => {
      expect(screen.getByText('deploy-1')).toBeInTheDocument();
    });

    // 4. Perform Restart Action
    const restartBtn = screen.getByTitle('Rollout Restart');
    mockApi.rolloutRestart = vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined });
    await user.click(restartBtn);

    // 5. Verify API called
    expect(mockApi.rolloutRestart).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceName: 'deploy-1',
        resourceType: 'deployments',
      })
    );

    // 6. Switch Namespace
    const nsSelect = screen.getByRole('combobox');

    // Mock empty response for kube-system before switching
    mockApi.getResources = vi
      .fn()
      .mockResolvedValue({ success: true, data: [] });

    await user.selectOptions(nsSelect, 'kube-system');

    // 7. Verify cleared list
    await waitFor(() => {
      expect(screen.queryByText('deploy-1')).not.toBeInTheDocument();
    });
  });
});
