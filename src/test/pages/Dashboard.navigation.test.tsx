import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, fireEvent } from '../utils';
import { createMockElectronAPI } from '../utils/mocks';
import { mockClusterState, mockToolStatus } from '../helpers/electron-helpers';
import { Dashboard } from '../../pages/Dashboard';

import '../mocks/modal-mocks';

/**
 * Where the Dashboard's buttons and cluster list lead, and the engine card
 * colour when Podman is installed but stopped.
 */

function CurrentPath() {
  return <p data-testid="current-path">{useLocation().pathname}</p>;
}

describe('Dashboard navigation', () => {
  let api: ReturnType<typeof createMockElectronAPI>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = createMockElectronAPI();
    mockClusterState(['kind-dev'], 'kind-dev', api);
    mockToolStatus({}, api);
  });

  const renderDashboard = () =>
    render(
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>,
      { api, initialEntries: ['/'] }
    );

  const path = () => screen.getByTestId('current-path');

  it('opens the cluster list from Manage Existing Clusters', async () => {
    renderDashboard();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Manage Existing Clusters' })
    );

    expect(path()).toHaveTextContent('/clusters');
  });

  it('opens the create form from Create New Cluster', async () => {
    renderDashboard();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Create New Cluster' })
    );

    expect(path()).toHaveTextContent('/create-cluster');
  });

  it('opens the create form from the empty state', async () => {
    mockClusterState([], 'None', api);
    renderDashboard();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Add a Cluster' })
    );

    expect(path()).toHaveTextContent('/create-cluster');
  });

  it('opens a cluster from the list with the keyboard', async () => {
    renderDashboard();
    const item = (
      await screen.findByText('kind-dev', {
        selector: '.cluster-item-name',
      })
    ).closest('[role="button"]') as HTMLElement;

    fireEvent.keyDown(item, { key: 'Tab' });
    expect(screen.queryByTestId('current-path')).toBeNull();

    fireEvent.keyDown(item, { key: 'Enter' });
    expect(path()).toHaveTextContent('/cluster/kind-dev');
  });

  it('opens a cluster from the list with a click', async () => {
    renderDashboard();
    const item = (
      await screen.findByText('kind-dev', {
        selector: '.cluster-item-name',
      })
    ).closest('[role="button"]') as HTMLElement;

    fireEvent.click(item);

    expect(path()).toHaveTextContent('/cluster/kind-dev');
  });

  it('marks an installed but stopped Podman in orange', async () => {
    mockToolStatus({ docker: true, podman: 'stopped' }, api);
    renderDashboard();

    const label = await screen.findByText('Stopped');
    const card = label.closest('.stat-card') as HTMLElement;

    expect(card).toHaveTextContent('Podman Status');
    expect(card.querySelector('.stat-card-icon-orange')).not.toBeNull();
  });
});
