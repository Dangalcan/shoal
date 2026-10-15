import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { render } from '../../utils';
import { mockElectronAPI } from '../../setup';
import { mockToast } from '../../mocks/toast-mock';
import { PluginNotifications } from '../../../features/plugins/PluginNotifications';
import type { Plugin } from '../../../../electron/types/plugin-types';
import type { PluginNotificationData } from '../../../types';

/**
 * Main-process plugin notifications reach the user as toasts, labelled with
 * the plugin's display name when the plugin is known.
 */

const installed: Plugin = {
  manifest: {
    id: 'namespace-watcher',
    name: 'Namespace Watcher',
    version: '1.0.0',
    description: '',
    author: 'Shoal',
    main: 'index.js',
    permissions: ['kubernetes'],
    license: { type: 'free', spdx: 'MIT' },
  },
  state: 'enabled',
  installedAt: '2026-10-01T00:00:00.000Z',
};

type Listener = (data: PluginNotificationData) => void;

describe('PluginNotifications', () => {
  let listener: Listener | null;
  const unsubscribe = vi.fn();

  beforeEach(() => {
    listener = null;
    unsubscribe.mockClear();
    mockElectronAPI.onPluginNotification.mockImplementation((cb: Listener) => {
      listener = cb;
      return unsubscribe;
    });
    mockElectronAPI.getPlugins.mockResolvedValue({
      success: true,
      data: [installed],
    });
  });

  async function renderAndSettle() {
    const view = render(<PluginNotifications />);
    await waitFor(() => expect(mockElectronAPI.getPlugins).toHaveBeenCalled());
    await waitFor(() => expect(listener).not.toBeNull());
    return view;
  }

  function notify(data: Partial<PluginNotificationData>) {
    act(() => {
      listener!({
        pluginId: 'namespace-watcher',
        message: 'hello',
        type: 'info',
        ...data,
      } as PluginNotificationData);
    });
  }

  it('renders nothing and unsubscribes on unmount', async () => {
    const { container, unmount } = await renderAndSettle();
    expect(container).toBeEmptyDOMElement();

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('maps each notification type to the matching toast', async () => {
    await renderAndSettle();
    await waitFor(() => expect(listener).not.toBeNull());

    notify({ message: 'all good', type: 'success' });
    notify({ message: 'broken', type: 'error' });
    notify({ message: 'careful', type: 'warning' });
    notify({ message: 'fyi', type: 'info' });

    const description = { description: 'From: Namespace Watcher' };
    expect(mockToast.success).toHaveBeenCalledWith('all good', description);
    expect(mockToast.error).toHaveBeenCalledWith('broken', description);
    expect(mockToast.warning).toHaveBeenCalledWith('careful', description);
    expect(mockToast.info).toHaveBeenCalledWith('fyi', description);
  });

  it('falls back to the plugin id when the plugin is not installed', async () => {
    await renderAndSettle();

    notify({ pluginId: 'ghost-plugin', message: 'boo', type: 'info' });

    expect(mockToast.info).toHaveBeenCalledWith('boo', {
      description: 'From: ghost-plugin',
    });
  });
});
