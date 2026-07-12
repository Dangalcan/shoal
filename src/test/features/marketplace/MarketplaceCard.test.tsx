import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { MarketplaceEntry } from '../../../types';
import type { Plugin } from '../../../../electron/types/plugin-types';

const api = {
  createCheckout: vi.fn(),
  getCheckoutStatus: vi.fn(),
  openExternal: vi.fn().mockResolvedValue({ success: true, data: true }),
};
const pluginsState: { plugins: Plugin[] } = { plugins: [] };
const activateLicense = vi.fn().mockResolvedValue(undefined);
const installPlugin = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../services/api-context', () => ({
  useApi: () => api,
}));
vi.mock('../../../features/plugins/PluginProvider', () => ({
  usePlugins: () => ({
    plugins: pluginsState.plugins,
    activateLicense,
    installPlugin,
  }),
}));

import { MarketplaceCard } from '../../../features/marketplace/MarketplaceCard';

const entry: MarketplaceEntry = {
  id: 'helm-manager',
  name: 'Helm Manager',
  version: '2.0.1',
  description: 'Manage Helm releases',
  author: 'DevOps Toolbox',
  category: 'DevTools',
  price: 19,
};

function installedPlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    manifest: { id: 'helm-manager' },
    state: 'enabled',
    installedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Plugin;
}

describe('MarketplaceCard ownership states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pluginsState.plugins = [];
  });

  it('shows a Buy button for a paid, not-installed plugin', () => {
    render(<MarketplaceCard entry={entry} onOpenDetail={vi.fn()} />);
    expect(screen.getByText(/Buy \$19/)).toBeInTheDocument();
    expect(screen.queryByText(/Licensed/)).not.toBeInTheDocument();
  });

  it('shows Licensed badge and button for an installed paid plugin with an active license', () => {
    pluginsState.plugins = [
      installedPlugin({ licenseInfo: { isActive: true } }),
    ];
    render(<MarketplaceCard entry={entry} onOpenDetail={vi.fn()} />);
    expect(screen.getAllByText(/Licensed/).length).toBeGreaterThanOrEqual(2); // badge + button
    expect(screen.queryByText(/Buy \$19/)).not.toBeInTheDocument();
  });

  it('shows Trial state for a plugin on an active trial', () => {
    pluginsState.plugins = [
      installedPlugin({
        state: 'trial',
        licenseInfo: { isActive: false, isTrialActive: true },
      }),
    ];
    render(<MarketplaceCard entry={entry} onOpenDetail={vi.fn()} />);
    expect(screen.getByText('Trial')).toBeInTheDocument();
    expect(screen.getByText(/Trial active/)).toBeInTheDocument();
  });

  it('shows an expired state with a re-buy button', () => {
    pluginsState.plugins = [
      installedPlugin({ state: 'expired', licenseInfo: { isActive: false } }),
    ];
    render(<MarketplaceCard entry={entry} onOpenDetail={vi.fn()} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText(/License expired — Buy \$19/)).toBeInTheDocument();
  });

  it('shows plain Installed for a free plugin', () => {
    pluginsState.plugins = [installedPlugin()];
    render(
      <MarketplaceCard entry={{ ...entry, price: 0 }} onOpenDetail={vi.fn()} />
    );
    expect(screen.getAllByText('Installed').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Licensed/)).not.toBeInTheDocument();
  });

  it('renders featured metadata and opens details with pointer or keyboard input', () => {
    const onOpenDetail = vi.fn();
    render(
      <MarketplaceCard
        entry={{ ...entry, icon: '/plugin.svg', rating: 4.5, reviews: 12 }}
        featured
        onOpenDetail={onOpenDetail}
      />
    );

    const card = screen.getByRole('button', { name: /Helm Manager/i });
    expect(card).toHaveClass('marketplace-card--featured');
    expect(screen.getByRole('img', { name: 'Helm Manager' })).toHaveAttribute(
      'src',
      '/plugin.svg'
    );
    expect(screen.getByLabelText('4.5 out of 5 stars')).toBeInTheDocument();

    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.click(card);
    expect(onOpenDetail).toHaveBeenCalledTimes(2);
  });

  it('shows the update state and installs without opening card details', async () => {
    const onOpenDetail = vi.fn();
    pluginsState.plugins = [installedPlugin({ hasUpdate: true })];
    installPlugin.mockResolvedValue(undefined);
    render(<MarketplaceCard entry={entry} onOpenDetail={onOpenDetail} />);

    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    expect(installPlugin).toHaveBeenCalledWith('helm-manager');
    expect(onOpenDetail).not.toHaveBeenCalled();
  });

  it('shows waiting state with a working Cancel button while awaiting payment', async () => {
    api.createCheckout.mockResolvedValue({
      success: true,
      data: { sessionId: 'cs_1', url: 'https://pay.test/cs_1' },
    });
    // Stay pending forever; cancel is what ends the flow.
    api.getCheckoutStatus.mockResolvedValue({
      success: true,
      data: { status: 'pending' },
    });

    render(<MarketplaceCard entry={entry} onOpenDetail={vi.fn()} />);
    fireEvent.click(screen.getByText(/Buy \$19/));

    const cancelBtn = await screen.findByText('Cancel');
    expect(screen.getByText(/Waiting for payment/)).toBeInTheDocument();

    fireEvent.click(cancelBtn);
    // Flow ends: the Buy button returns and nothing was installed.
    expect(await screen.findByText(/Buy \$19/)).toBeInTheDocument();
    expect(installPlugin).not.toHaveBeenCalled();
  });
});
