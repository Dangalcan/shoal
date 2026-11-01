import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../../App';
import { ApiProvider } from '../../services/api-context';
import { ClusterProvider } from '../../features/clusters/ClusterContext';
import { PluginProvider } from '../../features/plugins/PluginProvider';
import { createMockElectronAPI } from '../utils/mocks';

/**
 * The application router (a HashRouter, as in the packaged app): known hashes
 * open their page inside the layout, and an unknown hash (a stale bookmark
 * or a removed page) lands on the dashboard.
 */

describe('App routing', () => {
  let api: ReturnType<typeof createMockElectronAPI>;

  const renderApp = (hash: string) => {
    window.location.hash = hash;
    return render(
      <ApiProvider api={api}>
        <ClusterProvider>
          <PluginProvider>
            <App />
          </PluginProvider>
        </ClusterProvider>
      </ApiProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api = createMockElectronAPI();
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('redirects an unknown route to the dashboard', async () => {
    renderApp('#/no-such-page');

    expect(
      await screen.findByRole('heading', { name: 'Dashboard' })
    ).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe('#/'));
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveClass(
      'sidebar-link-active'
    );
  });

  it('opens a known route inside the layout', async () => {
    renderApp('#/clusters');

    expect(
      await screen.findByRole('heading', { name: 'Clusters' })
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#/clusters');
    expect(screen.getByRole('link', { name: 'Clusters' })).toHaveClass(
      'sidebar-link-active'
    );
  });
});
