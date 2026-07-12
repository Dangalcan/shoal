import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Plugin } from '../../../../electron/types/plugin-types';
import { mockToast } from '../../mocks/toast-mock';

const state: { plugins: Plugin[] } = { plugins: [] };
const installPlugin = vi.fn();

vi.mock('../../../features/plugins/PluginProvider', () => ({
  usePlugins: () => ({ plugins: state.plugins, installPlugin }),
}));

import { useInstallPlugin } from '../../../features/marketplace/useInstallPlugin';

describe('useInstallPlugin', () => {
  beforeEach(() => {
    state.plugins = [];
    installPlugin.mockReset();
  });

  it('installs an available plugin and reports success', async () => {
    installPlugin.mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useInstallPlugin('plugin-id', 'Plugin')
    );

    await act(async () => {
      await result.current.handleInstall();
    });

    expect(installPlugin).toHaveBeenCalledWith('plugin-id');
    expect(mockToast.loading).toHaveBeenCalledWith('Installing Plugin...');
    expect(mockToast.success).toHaveBeenCalledWith(
      'Plugin installed successfully!',
      expect.objectContaining({ id: expect.anything() })
    );
    expect(result.current.installing).toBe(false);
  });

  it('reports installation failures and restores the idle state', async () => {
    installPlugin.mockRejectedValue(new Error('Registry unavailable'));
    const { result } = renderHook(() =>
      useInstallPlugin('plugin-id', 'Plugin')
    );

    await act(async () => {
      await result.current.handleInstall();
    });

    expect(mockToast.error).toHaveBeenCalledWith(
      'Registry unavailable',
      expect.objectContaining({ id: expect.anything() })
    );
    expect(result.current.installing).toBe(false);
  });

  it('does not reinstall a plugin that is already present', async () => {
    state.plugins = [
      { manifest: { id: 'plugin-id' }, state: 'enabled' } as Plugin,
    ];
    const { result } = renderHook(() =>
      useInstallPlugin('plugin-id', 'Plugin')
    );

    await act(async () => {
      await result.current.handleInstall();
    });
    await waitFor(() => expect(result.current.isInstalled).toBe(true));

    expect(installPlugin).not.toHaveBeenCalled();
    expect(mockToast.loading).not.toHaveBeenCalled();
  });
});
