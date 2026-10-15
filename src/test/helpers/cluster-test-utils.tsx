import { render, screen } from '../utils';
import userEvent from '@testing-library/user-event';
import { createMockElectronAPI } from '../utils/mocks';
import { vi } from 'vitest';
import React from 'react';
import { Clusters } from '../../pages/Clusters';

// Export shared mock API for tests
export const mockApi = createMockElectronAPI();

/**
 * Mocks the cluster list response.
 */
export function mockClusters(names: string[]) {
  mockApi.getClusters = vi.fn().mockResolvedValue({
    success: true,
    data: names,
  });
}

/**
 * Mocks a cluster deletion response.
 */
export function mockClusterDeletion(success: boolean = true, error?: string) {
  mockApi.deleteCluster = vi.fn().mockResolvedValue({
    success,
    error,
    data: (success ? undefined : null) as any,
  });
}

/**
 * Simulates deleting a cluster via the UI.
 */
export async function deleteClusterViaUI(
  name: string,
  userInstance?: ReturnType<typeof userEvent.setup>
) {
  const user = userInstance || userEvent.setup();
  const deleteBtn = screen.getByTitle(`Delete ${name}`);
  await user.click(deleteBtn);

  // Modals might have a slight animation delay. kind/k3d clusters are
  // deleted; any other context is only removed from the kubeconfig, and the
  // dialog says so.
  const confirmBtn = await screen.findByRole(
    'button',
    { name: /^(Delete Cluster|Remove Context)$/ },
    { timeout: 2000 }
  );
  await user.click(confirmBtn);
}

/**
 * Standard render for Clusters page with optional initial data.
 */
export function renderClustersPage(clusters?: string[]) {
  if (clusters) {
    mockClusters(clusters);
  } else {
    mockClusters([]);
  }

  return render(React.createElement(Clusters), { api: mockApi });
}
