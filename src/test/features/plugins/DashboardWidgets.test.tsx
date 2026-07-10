import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Plugin } from '../../../../electron/types/plugin-types';

const state = vi.hoisted(() => ({
  plugins: [] as Plugin[],
  openModal: vi.fn(),
}));

vi.mock('../../../features/plugins/PluginProvider', () => ({
  usePlugins: () => ({ plugins: state.plugins, loading: false }),
}));

vi.mock('../../../features/plugins/sandbox/usePluginModal', () => ({
  usePluginModal: () => ({
    openModal: state.openModal,
    closeModal: vi.fn(),
    modalNode: <div data-testid="modal-node" />,
  }),
}));

// Stub the sandboxed frame: expose the frame's identity and a button that
// triggers onOpenModal so we can assert the host wiring.
vi.mock('../../../features/plugins/sandbox/PluginFrame', () => ({
  PluginFrame: ({
    pluginId,
    view,
    onOpenModal,
  }: {
    pluginId: string;
    view?: { kind: string; widgetId?: string };
    onOpenModal?: (id: string, props: unknown) => void;
  }) => (
    <button
      data-testid={`frame-${pluginId}-${view?.widgetId}`}
      onClick={() => onOpenModal?.('m1', { a: 1 })}
    >
      frame
    </button>
  ),
}));

import { DashboardWidgets } from '../../../features/plugins/DashboardWidgets';

function makePlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    manifest: {
      id: 'p1',
      name: 'P1',
      version: '1.0.0',
      description: '',
      author: '',
      license: { spdx: 'MIT' },
      permissions: ['kubernetes'],
      extensions: {
        widgets: [{ id: 'w1', title: 'Widget One', size: 'small' }],
      },
    },
    state: 'enabled',
    installedAt: '2026-01-01T00:00:00Z',
    rendererEntry: '/plugins/p1/renderer.js',
    rendererStyles: [],
    ...overrides,
  } as Plugin;
}

describe('DashboardWidgets', () => {
  beforeEach(() => {
    state.plugins = [];
    state.openModal.mockClear();
  });

  it('renders nothing when no plugin contributes widgets', () => {
    const { container } = render(<DashboardWidgets />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a frame per widget for enabled plugins', () => {
    state.plugins = [
      makePlugin({
        manifest: {
          ...makePlugin().manifest,
          extensions: {
            widgets: [
              { id: 'w1', title: 'One', size: 'small' },
              { id: 'w2', title: 'Two', size: 'large' },
            ],
          },
        },
      }),
    ];
    render(<DashboardWidgets />);
    expect(screen.getByTestId('frame-p1-w1')).toBeInTheDocument();
    expect(screen.getByTestId('frame-p1-w2')).toBeInTheDocument();
    expect(screen.getByText('Plugin Widgets')).toBeInTheDocument();
  });

  it('skips disabled plugins and plugins without a renderer entry', () => {
    state.plugins = [
      makePlugin({
        manifest: { ...makePlugin().manifest, id: 'disabled' },
        state: 'disabled',
      }),
      makePlugin({
        manifest: { ...makePlugin().manifest, id: 'norender' },
        rendererEntry: undefined,
      }),
      makePlugin({ manifest: { ...makePlugin().manifest, id: 'ok' } }),
    ];
    render(<DashboardWidgets />);
    expect(screen.queryByTestId('frame-disabled-w1')).toBeNull();
    expect(screen.queryByTestId('frame-norender-w1')).toBeNull();
    expect(screen.getByTestId('frame-ok-w1')).toBeInTheDocument();
  });

  it('wires a widget onOpenModal through to the modal controller', () => {
    state.plugins = [makePlugin()];
    render(<DashboardWidgets />);
    fireEvent.click(screen.getByTestId('frame-p1-w1'));
    expect(state.openModal).toHaveBeenCalledWith('p1', 'm1', { a: 1 });
    expect(screen.getByTestId('modal-node')).toBeInTheDocument();
  });

  it('renders no widgets for a plugin that declares none', () => {
    state.plugins = [
      makePlugin({
        manifest: { ...makePlugin().manifest, extensions: { widgets: [] } },
      }),
    ];
    const { container } = render(<DashboardWidgets />);
    expect(container.firstChild).toBeNull();
  });
});
