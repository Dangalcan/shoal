/**
 * LicenseActivationModal against a stubbed plugin context. The real provider
 * always rejects with an Error, so the generic messages for non-Error
 * failures need a fake `activateLicense` / `startTrial`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LicenseActivationModal } from '../../../features/plugins/LicenseActivationModal';
import { makePlugin } from './plugin-fixtures';

const ctx = vi.hoisted(() => ({
  activateLicense: vi.fn<(id: string, key: string) => Promise<void>>(),
  startTrial: vi.fn<(id: string) => Promise<void>>(),
}));

vi.mock('../../../features/plugins/PluginProvider', () => ({
  usePlugins: () => ({
    activateLicense: ctx.activateLicense,
    startTrial: ctx.startTrial,
  }),
}));

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

describe('LicenseActivationModal (stubbed context)', () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onClose = vi.fn<() => void>();
    ctx.activateLicense.mockReset();
    ctx.startTrial.mockReset();
  });

  it('shows a generic message when activation fails with a non-Error', async () => {
    ctx.activateLicense.mockRejectedValue('license server unreachable');
    render(<LicenseActivationModal plugin={paid} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('License Key'), {
      target: { value: 'PRO-AB12-CD34' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Activate License' }));

    expect(
      await screen.findByText('Failed to activate license')
    ).toBeInTheDocument();
    expect(ctx.activateLicense).toHaveBeenCalledWith('helm', 'PRO-AB12-CD34');
    expect(
      screen.getByRole('button', { name: 'Activate License' })
    ).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a generic message when the trial fails with a non-Error', async () => {
    ctx.startTrial.mockRejectedValue({ code: 'TRIAL_USED' });
    render(<LicenseActivationModal plugin={paid} onClose={onClose} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Start 14-Day Free Trial' })
    );

    expect(
      await screen.findByText('Failed to start trial')
    ).toBeInTheDocument();
    expect(ctx.startTrial).toHaveBeenCalledWith('helm');
    expect(
      screen.getByRole('button', { name: 'Start 14-Day Free Trial' })
    ).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
