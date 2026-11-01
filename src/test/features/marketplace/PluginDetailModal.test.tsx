import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, within, waitFor, userEvent } from '../../utils';
import { createMockElectronAPI } from '../../utils/mocks';
import { mockToast } from '../../mocks/toast-mock';
import type { MarketplaceEntry } from '../../../types';
import type { Result } from '../../../types/result';
import type {
  Plugin,
  PluginManifest,
} from '../../../../electron/types/plugin-types';
import { PluginDetailModal } from '../../../features/marketplace/PluginDetailModal';

const paidEntry: MarketplaceEntry = {
  id: 'helm-manager',
  name: 'Helm Manager',
  version: '2.0.1',
  description: 'Manage Helm releases',
  author: 'DevOps Toolbox',
  category: 'DevTools',
  price: 19,
};
const freeEntry: MarketplaceEntry = { ...paidEntry, price: 0 };

const EXPIRES_AT = '2027-03-15T12:00:00Z';
const TRIAL_ENDS_AT = '2026-11-20T12:00:00Z';
const expiryDate = new Date(EXPIRES_AT).toLocaleDateString();
const trialEndDate = new Date(TRIAL_ENDS_AT).toLocaleDateString();

/** The locally installed copy of the Helm Manager entry. */
function installedPlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    manifest: {
      id: 'helm-manager',
      name: 'Helm Manager',
      version: '2.0.1',
    } as PluginManifest,
    state: 'enabled',
    installedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('PluginDetailModal', () => {
  let api: ReturnType<typeof createMockElectronAPI>;
  let onClose: Mock<() => void>;

  beforeEach(() => {
    api = createMockElectronAPI();
    onClose = vi.fn<() => void>();
  });

  const renderModal = (entry: MarketplaceEntry = paidEntry) =>
    render(<PluginDetailModal entry={entry} onClose={onClose} />, { api });

  /** Installs `plugin` locally, then renders and waits for it to load. */
  async function renderOwned(
    plugin: Plugin,
    entry: MarketplaceEntry = paidEntry
  ) {
    api.getPlugins.mockResolvedValue({ success: true, data: [plugin] });
    renderModal(entry);
    await waitFor(() => expect(api.getPlugins).toHaveBeenCalled());
  }

  describe('header and details', () => {
    it('titles the dialog with the plugin name, author and version', () => {
      renderModal();

      const dialog = screen.getByRole('dialog', { name: 'Helm Manager' });
      expect(
        within(dialog).getByText('by DevOps Toolbox · v2.0.1')
      ).toBeInTheDocument();
    });

    it('shows the plugin icon when the entry has one', () => {
      renderModal({ ...paidEntry, icon: '/icons/helm.svg' });

      expect(screen.getByRole('img', { name: 'Helm Manager' })).toHaveAttribute(
        'src',
        '/icons/helm.svg'
      );
    });

    it('falls back to a generic icon without an entry icon', () => {
      renderModal();

      expect(
        screen.queryByRole('img', { name: 'Helm Manager' })
      ).not.toBeInTheDocument();
    });

    it('shows the category in its colour, rating and price of a paid plugin', () => {
      renderModal({ ...paidEntry, rating: 4.5, reviews: 12 });

      expect(screen.getByText('DevTools')).toHaveStyle({
        color: 'rgb(217, 119, 6)',
      });
      expect(screen.getByLabelText('4.5 out of 5 stars')).toBeInTheDocument();
      expect(screen.getByText('4.5 (12)')).toBeInTheDocument();
      expect(screen.getByText('$19')).toBeInTheDocument();
      expect(screen.queryByText('Free')).not.toBeInTheDocument();
    });

    it('uses the theme colour for an unknown category and says Free without a rating', () => {
      renderModal({ ...freeEntry, category: 'FinOps' });

      expect(screen.getByText('FinOps')).toHaveStyle({
        color: 'var(--color-primary)',
      });
      expect(screen.queryByLabelText(/out of 5 stars/)).not.toBeInTheDocument();
      expect(screen.getByText('Free')).toBeInTheDocument();
    });

    it('prefers the long description and shows tags and the changelog', () => {
      renderModal({
        ...paidEntry,
        longDescription: 'Install, upgrade and roll back Helm releases.',
        tags: ['helm', 'charts'],
        changelog: '2.0.1: fixed rollback',
      });

      expect(
        screen.getByText('Install, upgrade and roll back Helm releases.')
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Manage Helm releases')
      ).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Tags' })).toBeInTheDocument();
      expect(screen.getByText('helm')).toBeInTheDocument();
      expect(screen.getByText('charts')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: "What's New" })
      ).toBeInTheDocument();
      expect(screen.getByText('2.0.1: fixed rollback')).toBeInTheDocument();
    });

    it('falls back to the short description and leaves out empty sections', () => {
      renderModal({ ...paidEntry, longDescription: '' });

      expect(
        screen.getByRole('heading', { name: 'About' })
      ).toBeInTheDocument();
      expect(screen.getByText('Manage Helm releases')).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Tags' })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: "What's New" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Permissions' })
      ).not.toBeInTheDocument();
    });

    it('leaves out the permissions section for an empty permission list', () => {
      renderModal({ ...paidEntry, manifest: { permissions: [] } });

      expect(
        screen.queryByRole('heading', { name: 'Permissions' })
      ).not.toBeInTheDocument();
    });

    it('explains known permissions and shows unknown ones by name', () => {
      renderModal({
        ...paidEntry,
        manifest: { permissions: ['kubernetes', 'helm', 'telemetry'] },
      });

      expect(
        screen.getByRole('heading', { name: 'Permissions' })
      ).toBeInTheDocument();
      expect(screen.getByText('Read the cluster')).toBeInTheDocument();
      expect(
        screen.getByText(
          'List and read resources, logs, metrics and events (Secrets without their data)'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('Helm')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Install, upgrade, roll back and uninstall releases, manage repositories'
        )
      ).toBeInTheDocument();
      const unknown = screen.getByText('telemetry');
      expect(unknown.nextElementSibling).toBeEmptyDOMElement();
    });

    it('closes from the close button', async () => {
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: 'Close modal' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('screenshot gallery', () => {
    it('has no gallery without screenshots', () => {
      renderModal();

      expect(
        screen.queryByRole('img', { name: /screenshot/i })
      ).not.toBeInTheDocument();
    });

    it('shows a single screenshot without navigation or thumbnails', () => {
      renderModal({ ...paidEntry, screenshots: ['/shots/one.png'] });

      expect(
        screen.getByRole('img', { name: 'Helm Manager screenshot 1' })
      ).toHaveAttribute('src', '/shots/one.png');
      expect(
        screen.queryByRole('button', { name: 'Next screenshot' })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Previous screenshot' })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('img', { name: 'Screenshot 1' })
      ).not.toBeInTheDocument();
    });

    it('steps through several screenshots with wrap-around and thumbnails', async () => {
      const user = userEvent.setup();
      renderModal({
        ...paidEntry,
        screenshots: ['/shots/one.png', '/shots/two.png', '/shots/three.png'],
      });

      const main = () =>
        screen.getByRole('img', { name: /^Helm Manager screenshot/ });
      expect(main()).toHaveAccessibleName('Helm Manager screenshot 1');
      expect(screen.getByRole('img', { name: 'Screenshot 1' })).toHaveClass(
        'active'
      );

      await user.click(screen.getByRole('button', { name: 'Next screenshot' }));
      expect(main()).toHaveAccessibleName('Helm Manager screenshot 2');
      expect(main()).toHaveAttribute('src', '/shots/two.png');

      await user.click(
        screen.getByRole('button', { name: 'Previous screenshot' })
      );
      await user.click(
        screen.getByRole('button', { name: 'Previous screenshot' })
      );
      expect(main()).toHaveAccessibleName('Helm Manager screenshot 3');
      expect(main()).toHaveAttribute('src', '/shots/three.png');

      await user.click(screen.getByRole('button', { name: 'Next screenshot' }));
      expect(main()).toHaveAccessibleName('Helm Manager screenshot 1');

      await user.click(screen.getByRole('img', { name: 'Screenshot 2' }));
      expect(main()).toHaveAttribute('src', '/shots/two.png');
      expect(screen.getByRole('img', { name: 'Screenshot 2' })).toHaveClass(
        'active'
      );
      expect(screen.getByRole('img', { name: 'Screenshot 1' })).not.toHaveClass(
        'active'
      );
    });
  });

  describe('install and ownership actions', () => {
    it('installs a free plugin, showing progress until it is installed', async () => {
      const user = userEvent.setup();
      const install = deferred<Result<void>>();
      api.installPlugin.mockReturnValueOnce(install.promise);
      renderModal(freeEntry);

      await user.click(screen.getByRole('button', { name: 'Install' }));

      expect(api.installPlugin).toHaveBeenCalledWith('helm-manager');
      expect(
        screen.getByRole('button', { name: 'Installing...' })
      ).toBeDisabled();

      api.getPlugins.mockResolvedValue({
        success: true,
        data: [installedPlugin()],
      });
      install.resolve({ success: true, data: undefined });

      expect(
        await screen.findByRole('button', { name: 'Installed' })
      ).toBeDisabled();
      expect(mockToast.success).toHaveBeenCalledWith(
        'Helm Manager installed successfully!',
        expect.objectContaining({ id: expect.anything() })
      );
    });

    it('shows Installed for a free plugin that is already installed', async () => {
      await renderOwned(installedPlugin(), freeEntry);

      expect(
        await screen.findByRole('button', { name: 'Installed' })
      ).toBeDisabled();
      expect(
        screen.queryByRole('button', { name: 'Install' })
      ).not.toBeInTheDocument();
    });

    it('buys, activates and installs a paid plugin', async () => {
      const user = userEvent.setup();
      // The plugin list reports the license once it has been activated.
      api.activatePluginLicense.mockImplementation(async () => {
        api.getPlugins.mockResolvedValue({
          success: true,
          data: [installedPlugin({ licenseInfo: { isActive: true } })],
        });
        return { success: true, data: undefined };
      });
      renderModal();

      await user.click(
        screen.getByRole('button', { name: 'Buy & Install — $19' })
      );

      expect(
        await screen.findByRole('button', { name: 'Licensed' })
      ).toBeDisabled();
      expect(api.createCheckout).toHaveBeenCalledWith('helm-manager');
      expect(api.openExternal).toHaveBeenCalledWith('https://example.com/pay');
      expect(api.activatePluginLicense).toHaveBeenCalledWith(
        'helm-manager',
        'LIC-MOCK'
      );
      expect(api.installPlugin).toHaveBeenCalledWith('helm-manager');
      expect(mockToast.success).toHaveBeenCalledWith(
        'Helm Manager purchased and installed!',
        expect.objectContaining({ id: expect.anything() })
      );
    });

    it('shows Purchasing... while checkout starts, without a cancel button', async () => {
      const user = userEvent.setup();
      const checkout =
        deferred<Awaited<ReturnType<typeof api.createCheckout>>>();
      api.createCheckout.mockReturnValueOnce(checkout.promise);
      renderModal();

      await user.click(
        screen.getByRole('button', { name: 'Buy & Install — $19' })
      );

      expect(
        screen.getByRole('button', { name: 'Purchasing...' })
      ).toBeDisabled();
      expect(
        screen.queryByRole('button', { name: 'Cancel' })
      ).not.toBeInTheDocument();

      checkout.resolve({ success: false, error: 'Checkout unavailable' });

      expect(
        await screen.findByRole('button', { name: 'Buy & Install — $19' })
      ).toBeEnabled();
      expect(mockToast.error).toHaveBeenCalledWith(
        'Checkout unavailable',
        expect.objectContaining({ id: expect.anything() })
      );
      expect(api.openExternal).not.toHaveBeenCalled();
    });

    it('waits for the payment and can cancel the wait', async () => {
      const user = userEvent.setup();
      api.getCheckoutStatus.mockResolvedValue({
        success: true,
        data: { status: 'pending' },
      });
      renderModal();

      await user.click(
        screen.getByRole('button', { name: 'Buy & Install — $19' })
      );

      const cancel = await screen.findByRole('button', { name: 'Cancel' });
      expect(
        screen.getByRole('button', { name: 'Waiting for payment...' })
      ).toBeDisabled();

      await user.click(cancel);

      expect(
        await screen.findByRole('button', { name: 'Buy & Install — $19' })
      ).toBeInTheDocument();
      expect(mockToast.info).toHaveBeenCalledWith(
        expect.stringContaining('Purchase of Helm Manager cancelled'),
        expect.objectContaining({ id: expect.anything() })
      );
      expect(api.activatePluginLicense).not.toHaveBeenCalled();
      expect(api.installPlugin).not.toHaveBeenCalled();
    });

    it('shows a licensed plugin with its expiry date', async () => {
      await renderOwned(
        installedPlugin({
          licenseInfo: { isActive: true, expiresAt: EXPIRES_AT },
        })
      );

      expect(
        await screen.findByRole('button', { name: 'Licensed' })
      ).toBeDisabled();
      expect(
        screen.getByText(`License valid until ${expiryDate}.`)
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Buy/ })
      ).not.toBeInTheDocument();
    });

    it('shows a licensed plugin without an expiry line when it never expires', async () => {
      await renderOwned(installedPlugin({ licenseInfo: { isActive: true } }));

      expect(
        await screen.findByRole('button', { name: 'Licensed' })
      ).toBeDisabled();
      expect(screen.queryByText(/License valid until/)).not.toBeInTheDocument();
    });

    it('shows an active trial with its end date', async () => {
      await renderOwned(
        installedPlugin({
          state: 'trial',
          licenseInfo: {
            isActive: false,
            isTrialActive: true,
            trialEndsAt: TRIAL_ENDS_AT,
          },
        })
      );

      expect(
        await screen.findByRole('button', { name: 'Trial active' })
      ).toBeDisabled();
      expect(
        screen.getByText(
          `Trial ends ${trialEndDate}. Buy a license to keep using Helm Manager afterwards.`
        )
      ).toBeInTheDocument();
    });

    it('shows an active trial without an end date', async () => {
      await renderOwned(installedPlugin({ state: 'trial' }));

      expect(
        await screen.findByRole('button', { name: 'Trial active' })
      ).toBeDisabled();
      expect(
        screen.getByText('Buy a license to keep using Helm Manager afterwards.')
      ).toBeInTheDocument();
    });

    it('offers to buy again when the license expired, with the expiry date', async () => {
      const user = userEvent.setup();
      api.getCheckoutStatus.mockResolvedValue({
        success: true,
        data: { status: 'pending' },
      });
      await renderOwned(
        installedPlugin({
          state: 'expired',
          licenseInfo: { isActive: false, expiresAt: EXPIRES_AT },
        })
      );

      const buyAgain = await screen.findByRole('button', {
        name: 'Buy again — $19',
      });
      expect(
        screen.getByText(`Your license has expired (on ${expiryDate}).`)
      ).toBeInTheDocument();

      await user.click(buyAgain);

      expect(api.createCheckout).toHaveBeenCalledWith('helm-manager');
      await user.click(await screen.findByRole('button', { name: 'Cancel' }));
      expect(
        await screen.findByRole('button', { name: 'Buy again — $19' })
      ).toBeInTheDocument();
    });

    it('says the license expired without a date when none is known', async () => {
      await renderOwned(
        installedPlugin({ state: 'expired', licenseInfo: { isActive: false } })
      );

      await screen.findByRole('button', { name: 'Buy again — $19' });
      expect(screen.getByText('Your license has expired.')).toBeInTheDocument();
    });
  });
});
