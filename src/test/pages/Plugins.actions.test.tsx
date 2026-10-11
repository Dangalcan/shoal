import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '../utils';
import { createMockElectronAPI } from '../utils/mocks';
import { mockToast } from '../mocks/toast-mock';
import { makePlugin } from '../features/plugins/plugin-fixtures';
import Plugins from '../../pages/Plugins';
import type { Plugin } from '../../../electron/types/plugin-types';

vi.mock('../../features/marketplace/MarketplaceList', () => ({
  MarketplaceList: () => <div>marketplace list</div>,
}));

const watcher = makePlugin({
  state: 'enabled',
  manifest: {
    id: 'watcher',
    name: 'Watcher',
    homepage: 'https://example.com/watcher',
    configuration: {
      properties: {
        interval: { type: 'number', label: 'Interval', default: 30 },
      },
    },
  },
});

const helm = makePlugin({
  state: 'disabled',
  hasUpdate: true,
  latestVersion: '2.0.0',
  error: 'Failed to start',
  manifest: {
    id: 'helm',
    name: 'Helm Manager',
    license: {
      type: 'paid',
      spdx: 'proprietary',
      pricing: { model: 'one-time', price: 10, currency: 'EUR', trialDays: 14 },
    },
  },
});

const logs = makePlugin({
  state: 'disabled',
  licenseInfo: { isActive: true },
  manifest: {
    id: 'logs',
    name: 'Logs',
    license: { type: 'subscription', spdx: 'proprietary' },
  },
});

describe('Plugins page actions', () => {
  let api: ReturnType<typeof createMockElectronAPI>;

  const renderPage = async (plugins: Plugin[] = [watcher, helm, logs]) => {
    api.getPlugins = vi
      .fn()
      .mockResolvedValue({ success: true, data: plugins });
    render(<Plugins />, { api });
    await screen.findByText(
      plugins[0]?.manifest.name ?? 'No plugins installed.'
    );
  };

  const card = (name: string) =>
    screen.getByText(name).closest('.plugin-card') as HTMLElement;

  beforeEach(() => {
    api = createMockElectronAPI();
  });

  it('shows each plugin with its state, license, error and links', async () => {
    await renderPage();

    expect(within(card('Watcher')).getByText('Enabled')).toBeInTheDocument();
    expect(within(card('Watcher')).getByText('MIT')).toBeInTheDocument();
    expect(
      within(card('Watcher')).getByRole('link', { name: 'Homepage' })
    ).toHaveAttribute('href', 'https://example.com/watcher');
    expect(
      within(card('Helm Manager')).getByText('paid (proprietary)')
    ).toBeInTheDocument();
    expect(
      within(card('Helm Manager')).getByText('Failed to start')
    ).toBeInTheDocument();
    expect(
      within(card('Helm Manager')).getByText(/Latest: v2\.0\.0/)
    ).toBeInTheDocument();
  });

  it('disables an enabled plugin', async () => {
    await renderPage();

    fireEvent.click(
      within(card('Watcher')).getByRole('button', { name: 'Disable' })
    );

    await waitFor(() =>
      expect(api.disablePlugin).toHaveBeenCalledWith('watcher')
    );
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith(
        'Plugin disabled.',
        expect.anything()
      )
    );
  });

  it('enables a plugin and names the dependencies enabled with it', async () => {
    api.enablePlugin = vi
      .fn()
      .mockResolvedValue({ success: true, data: ['watcher'] });
    await renderPage();

    fireEvent.click(
      within(card('Helm Manager')).getByRole('button', { name: 'Enable' })
    );

    await waitFor(() => expect(api.enablePlugin).toHaveBeenCalledWith('helm'));
    await waitFor(() =>
      expect(mockToast.info).toHaveBeenCalledWith(
        'Also enabled: Watcher',
        expect.anything()
      )
    );
    expect(mockToast.success).toHaveBeenCalledWith(
      'Plugin enabled.',
      expect.anything()
    );
  });

  it('reports a plugin that fails to enable', async () => {
    api.enablePlugin = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'missing dependency' });
    await renderPage();

    fireEvent.click(
      within(card('Helm Manager')).getByRole('button', { name: 'Enable' })
    );

    await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it('reloads an enabled plugin', async () => {
    await renderPage();

    fireEvent.click(within(card('Watcher')).getByTitle('Reload Plugin'));

    await waitFor(() =>
      expect(api.reloadPlugin).toHaveBeenCalledWith('watcher')
    );
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith(
        'Plugin reloaded.',
        expect.anything()
      )
    );
  });

  it('updates a plugin after confirmation', async () => {
    await renderPage();

    fireEvent.click(
      within(card('Helm Manager')).getByRole('button', { name: 'Update' })
    );
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('Update Helm Manager to v2.0.0?')
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Update' }));

    await waitFor(() => expect(api.installPlugin).toHaveBeenCalledWith('helm'));
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith(
        'Plugin updated successfully.',
        expect.anything()
      )
    );
  });

  it('disables an enabled plugin before uninstalling it', async () => {
    await renderPage();

    fireEvent.click(within(card('Watcher')).getByTitle('Uninstall Plugin'));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Uninstall',
      })
    );

    await waitFor(() =>
      expect(api.uninstallPlugin).toHaveBeenCalledWith('watcher')
    );
    expect(api.disablePlugin).toHaveBeenCalledWith('watcher');
  });

  it('uninstalls a disabled plugin directly', async () => {
    await renderPage();

    fireEvent.click(
      within(card('Helm Manager')).getByTitle('Uninstall Plugin')
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Uninstall',
      })
    );

    await waitFor(() =>
      expect(api.uninstallPlugin).toHaveBeenCalledWith('helm')
    );
    expect(api.disablePlugin).not.toHaveBeenCalled();
  });

  it('closes the uninstall confirmation without uninstalling', async () => {
    await renderPage();

    fireEvent.click(
      within(card('Helm Manager')).getByTitle('Uninstall Plugin')
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' })
    );

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    expect(api.uninstallPlugin).not.toHaveBeenCalled();
  });

  it('deactivates an active license after confirmation', async () => {
    await renderPage();

    fireEvent.click(
      within(card('Logs')).getByRole('button', { name: 'Deactivate License' })
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Deactivate',
      })
    );

    await waitFor(() =>
      expect(api.deactivatePluginLicense).toHaveBeenCalledWith('logs')
    );
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith(
        'License deactivated.',
        expect.anything()
      )
    );
  });

  it('opens the license and settings dialogs', async () => {
    await renderPage();

    fireEvent.click(
      within(card('Helm Manager')).getByRole('button', {
        name: 'Activate License',
      })
    );
    expect(
      await screen.findByText('Activate Helm Manager')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close modal'));
    await waitFor(() =>
      expect(
        screen.queryByText('Activate Helm Manager')
      ).not.toBeInTheDocument()
    );

    fireEvent.click(within(card('Watcher')).getByTitle('Settings'));
    expect(await screen.findByText('Settings: Watcher')).toBeInTheDocument();
    await waitFor(() =>
      expect(api.getPluginSettings).toHaveBeenCalledWith('watcher')
    );
  });

  it('imports an unpacked plugin', async () => {
    await renderPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Load Unpacked Plugin' })
    );

    await waitFor(() => expect(api.importLocalPlugin).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith(
        'Plugin imported.',
        expect.anything()
      )
    );
    expect(
      screen.getByRole('button', { name: 'Load Unpacked Plugin' })
    ).toBeEnabled();
  });

  it('reports an import the app refuses', async () => {
    api.importLocalPlugin = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'not signed' });
    await renderPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Load Unpacked Plugin' })
    );

    await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    expect(mockToast.success).not.toHaveBeenCalledWith(
      'Plugin imported.',
      expect.anything()
    );
  });

  it('switches between the installed list and the marketplace', async () => {
    await renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Marketplace/ }));
    expect(screen.getByText('marketplace list')).toBeInTheDocument();
    expect(screen.queryByText('Watcher')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Installed/ }));
    expect(screen.getByText('Watcher')).toBeInTheDocument();
  });

  it('suggests the marketplace when nothing is installed', async () => {
    await renderPage([]);
    expect(
      screen.getByText('Check out the Marketplace to find plugins!')
    ).toBeInTheDocument();
  });

  it('shows the load error and retries', async () => {
    api.getPlugins = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'IPC down' });
    render(<Plugins />, { api });

    expect(await screen.findByText('IPC down')).toBeInTheDocument();
    const calls = vi.mocked(api.getPlugins).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() =>
      expect(vi.mocked(api.getPlugins).mock.calls.length).toBeGreaterThan(calls)
    );
  });

  it('shows a spinner while plugins load', () => {
    api.getPlugins = vi.fn(() => new Promise(() => {}));
    render(<Plugins />, { api });

    expect(screen.getByText('Loading plugins...')).toBeInTheDocument();
  });
});
