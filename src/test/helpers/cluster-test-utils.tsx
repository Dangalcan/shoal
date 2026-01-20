import { render, screen, waitFor } from '../utils';
import userEvent from '@testing-library/user-event';
import { mockElectronAPI } from '../setup';
import { vi } from 'vitest';
import React from 'react';
import { Clusters } from '../../pages/Clusters';

/**
 * Mocks the cluster list response.
 */
export function mockClusters(names: string[]) {
  mockElectronAPI.getClusters.mockResolvedValue({
    success: true,
    data: names
  });
}

/**
 * Mocks a cluster deletion response.
 */
export function mockClusterDeletion(success: boolean = true, error?: string) {
  mockElectronAPI.deleteCluster.mockResolvedValue({
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
  
  return render(React.createElement(Clusters));
}
