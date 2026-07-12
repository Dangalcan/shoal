import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, render } from '@testing-library/react';
import type { Plugin } from '../../../../../electron/types/plugin-types';

const state = vi.hoisted(() => ({ plugins: [] as Plugin[] }));

vi.mock('../../../../features/plugins/PluginProvider', () => ({
  usePlugins: () => ({ plugins: state.plugins, loading: false }),
}));

vi.mock('../../../../features/plugins/sandbox/PluginModalHost', () => ({
  PluginModalHost: ({
    pluginId,
    modalId,
  }: {
    pluginId: string;
    modalId: string;
  }) => (
    <div data-testid="modal-host" data-plugin={pluginId} data-modal={modalId} />
  ),
}));

import { usePluginModal } from '../../../../features/plugins/sandbox/usePluginModal';

function makePlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    manifest: {
      id: 'p1',
      name: 'P1',
      version: '1.0.0',
      description: '',
      author: '',
      license: { spdx: 'MIT' },
      permissions: [],
    },
    state: 'enabled',
    installedAt: '2026-01-01T00:00:00Z',
    rendererEntry: '/plugins/p1/renderer.js',
    rendererStyles: [],
    ...overrides,
  } as Plugin;
}

describe('usePluginModal', () => {
  beforeEach(() => {
    state.plugins = [makePlugin()];
  });

  it('has no modal node before anything is opened', () => {
    const { result } = renderHook(() => usePluginModal());
    expect(result.current.modalNode).toBeNull();
  });

  it('renders a modal host once a modal is opened, and clears it on close', () => {
    const { result } = renderHook(() => usePluginModal());
    act(() => result.current.openModal('p1', 'confirm', { name: 'pod-1' }));

    const { getByTestId, queryByTestId } = render(
      <>{result.current.modalNode}</>
    );
    const host = getByTestId('modal-host');
    expect(host).toHaveAttribute('data-plugin', 'p1');
    expect(host).toHaveAttribute('data-modal', 'confirm');

    act(() => result.current.closeModal());
    expect(result.current.modalNode).toBeNull();
    // Re-render with the now-null node.
    const { container } = render(<>{result.current.modalNode}</>);
    expect(queryByTestId).toBeDefined();
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the opened plugin id is unknown', () => {
    const { result } = renderHook(() => usePluginModal());
    act(() => result.current.openModal('missing', 'confirm'));
    expect(result.current.modalNode).toBeNull();
  });

  it('renders nothing when the plugin has no renderer (null urls)', () => {
    state.plugins = [makePlugin({ rendererEntry: undefined })];
    const { result } = renderHook(() => usePluginModal());
    act(() => result.current.openModal('p1', 'confirm'));
    expect(result.current.modalNode).toBeNull();
  });
});
