import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils';
import { createMockElectronAPI } from '../utils/mocks';
import Plugins from '../../pages/Plugins';

vi.mock('../../features/plugins/PluginProvider', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../features/plugins/PluginProvider')
  >()),
  usePlugins: vi.fn(() => ({
    plugins: [],
    loading: false,
    error: null,
    enablePlugin: vi.fn(),
    disablePlugin: vi.fn(),
    refreshPlugins: vi.fn(),
    deactivateLicense: vi.fn(),
    installPlugin: vi.fn(),
    reloadPlugin: vi.fn(),
    uninstallPlugin: vi.fn(),
    importLocalPlugin: vi.fn(),
  })),
}));

vi.mock('../../features/marketplace/MarketplaceList', () => ({
  MarketplaceList: () => <div>marketplace list</div>,
}));

describe('Plugins page marketplace flag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides the Marketplace tab when the marketplace is disabled', async () => {
    const api = createMockElectronAPI({
      getFeatureFlags: vi
        .fn()
        .mockResolvedValue({ success: true, data: { marketplace: false } }),
    });

    render(<Plugins />, { api });

    await waitFor(() => expect(api.getFeatureFlags).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /marketplace/i })).toBeNull();
    expect(
      screen.getByText('The plugin marketplace arrives with Shoal 1.0.')
    ).toBeInTheDocument();
  });

  it('shows the Marketplace tab when the marketplace is enabled', async () => {
    const api = createMockElectronAPI({
      getFeatureFlags: vi
        .fn()
        .mockResolvedValue({ success: true, data: { marketplace: true } }),
    });

    render(<Plugins />, { api });

    expect(
      await screen.findByRole('button', { name: /marketplace/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Check out the Marketplace to find plugins!')
    ).toBeInTheDocument();
  });
});
