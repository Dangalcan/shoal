import { render, screen, waitFor } from '../utils';
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
    data: names
  });
}

/**
 * Mocks a cluster deletion response.
 */
export function mockClusterDeletion(success: boolean = true, error?: string) {
  mockApi.deleteCluster = vi.fn().mockResolvedValue({
    success,
    error,
    data: (success ? undefined : null) as any
  });
}

/**
 * Simulates deleting a cluster via the UI.
 */
export async function deleteClusterViaUI(name: string) {
  const user = userEvent.setup();
  const deleteBtn = screen.getByTitle(`Delete ${name}`);
  await user.click(deleteBtn);
  
  const confirmBtn = await screen.findByRole('button', { name: 'Delete Cluster' });
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
