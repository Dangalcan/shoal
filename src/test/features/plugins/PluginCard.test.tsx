import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  PluginCard,
  getPluginStateClass,
  getPluginStateLabel,
} from '../../../features/plugins/PluginCard';
import { makePlugin } from './plugin-fixtures';
import type { Plugin } from '../../../../electron/types/plugin-types';

function renderCard(plugin: Plugin, actionLoading: string | null = null) {
  render(
    <PluginCard
      plugin={plugin}
      actionLoading={actionLoading}
      onToggle={vi.fn()}
      onUpdate={vi.fn()}
      onOpenLicense={vi.fn()}
      onDeactivateLicense={vi.fn()}
      onReload={vi.fn()}
      onOpenSettings={vi.fn()}
      onUninstall={vi.fn()}
    />
  );
}

describe('PluginCard', () => {
  it('maps plugin states to labels and classes', () => {
    expect(getPluginStateLabel('enabled')).toBe('Enabled');
    expect(getPluginStateClass('error')).toBe('plugin-state--error');
    expect(getPluginStateLabel('expired')).toBe('expired');
    expect(getPluginStateClass('expired')).toBe('');
  });

  it('shows progress labels while its action runs', () => {
    renderCard(
      makePlugin({ state: 'enabled', hasUpdate: true, latestVersion: '2.0.0' }),
      'p1'
    );

    expect(screen.getByRole('button', { name: 'Disabling...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Updating...' })).toBeDisabled();
    expect(screen.getByTitle('Uninstall Plugin')).toBeDisabled();
  });

  it('says Enabling while a disabled plugin turns on', () => {
    renderCard(makePlugin({ state: 'disabled' }), 'p1');
    expect(screen.getByRole('button', { name: 'Enabling...' })).toBeDisabled();
  });

  it('disables the toggle while the plugin is loading and hides empty permissions', () => {
    renderCard(makePlugin({ state: 'loading', manifest: { permissions: [] } }));

    expect(screen.getByRole('button', { name: 'Enable' })).toBeDisabled();
    expect(screen.queryByText('Permissions:')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Reload Plugin')).not.toBeInTheDocument();
  });
});
