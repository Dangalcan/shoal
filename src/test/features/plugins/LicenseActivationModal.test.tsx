import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../utils';
import { createMockElectronAPI } from '../../utils/mocks';
import { LicenseActivationModal } from '../../../features/plugins/LicenseActivationModal';
import { makePlugin } from './plugin-fixtures';

const paid = makePlugin({
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

describe('LicenseActivationModal', () => {
  let api: ReturnType<typeof createMockElectronAPI>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    api = createMockElectronAPI();
    onClose = vi.fn();
  });

  const renderModal = (plugin = paid) =>
    render(<LicenseActivationModal plugin={plugin} onClose={onClose} />, {
      api,
    });

  it('upper-cases the key and explains the format of a bad one', () => {
    renderModal();
    const input = screen.getByLabelText('License Key');

    expect(
      screen.getByText(/Enter the key exactly as received/)
    ).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'pro-12' } });
    expect(input).toHaveValue('PRO-12');
    fireEvent.blur(input);

    expect(screen.getByText(/Format: PREFIX-XXXX-XXXX/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Activate License' })
    ).toBeDisabled();
  });

  it('does not submit an invalid key', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('License Key'), {
      target: { value: 'nope' },
    });
    fireEvent.submit(
      screen.getByLabelText('License Key').closest('form') as HTMLFormElement
    );

    expect(api.activatePluginLicense).not.toHaveBeenCalled();
  });

  it('activates a valid key and closes shortly after', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('License Key'), {
      target: { value: 'pro-ab12-cd34-ef56' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Activate License' }));

    await waitFor(() =>
      expect(api.activatePluginLicense).toHaveBeenCalledWith(
        'helm',
        'PRO-AB12-CD34-EF56'
      )
    );
    expect(
      await screen.findByText('License activated successfully!')
    ).toBeInTheDocument();
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('shows why an activation failed', async () => {
    api.activatePluginLicense = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'Key revoked' });
    renderModal();
    fireEvent.change(screen.getByLabelText('License Key'), {
      target: { value: 'PRO-AB12-CD34' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Activate License' }));

    expect(await screen.findByText('Key revoked')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a one-time price and starts the free trial', async () => {
    renderModal();
    expect(screen.getByText('EUR 10 (One-time)')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Start 14-Day Free Trial/ })
    );

    await waitFor(() =>
      expect(api.startPluginTrial).toHaveBeenCalledWith('helm')
    );
    expect(
      await screen.findByText('Trial started! You have 14 days.')
    ).toBeInTheDocument();
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('shows why a trial could not start', async () => {
    api.startPluginTrial = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'Trial already used' });
    renderModal();

    fireEvent.click(
      screen.getByRole('button', { name: /Start 14-Day Free Trial/ })
    );

    expect(await screen.findByText('Trial already used')).toBeInTheDocument();
  });

  it('shows a recurring price and no trial once one was used', () => {
    renderModal(
      makePlugin({
        licenseInfo: { isActive: false, trialEndsAt: '2026-01-01T00:00:00Z' },
        manifest: {
          id: 'logs',
          name: 'Logs',
          homepage: 'https://example.com/logs',
          license: {
            type: 'paid',
            spdx: 'proprietary',
            pricing: {
              model: 'subscription',
              price: 5,
              currency: 'USD',
              interval: 'monthly',
              trialDays: 7,
            },
          },
        },
      })
    );

    expect(screen.getByText('USD 5 / monthly')).toBeInTheDocument();
    expect(screen.queryByText(/Free Trial/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Purchase one here' })
    ).toHaveAttribute('href', 'https://example.com/logs');
  });
});
