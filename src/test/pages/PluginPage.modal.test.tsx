import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PluginFrameView } from '../../features/plugins/sandbox/PluginFrame';

// Mock the router hooks PluginPage uses.
vi.mock('react-router-dom', () => ({
  useParams: () => ({ pluginId: 'p1' }),
  useNavigate: () => vi.fn(),
}));

// Mock the plugin provider to expose one enabled plugin with a renderer.
vi.mock('../../features/plugins/PluginProvider', () => ({
  usePlugins: () => ({
    loading: false,
    plugins: [
      {
        manifest: { id: 'p1', name: 'Plugin One', permissions: ['ui'] },
        state: 'enabled',
        rendererEntry: '/plugins/p1/renderer.js',
        rendererStyles: [],
      },
    ],
  }),
}));

// Mock PluginFrame: the page frame exposes a button to open a modal; a modal
// frame exposes a button to close it. Lets us drive the host wiring without a
// real iframe.
vi.mock('../../features/plugins/sandbox/PluginFrame', () => ({
  PluginFrame: ({
    view,
    onOpenModal,
    onCloseModal,
  }: {
    view?: PluginFrameView;
    onOpenModal?: (id: string, props: unknown) => void;
    onCloseModal?: () => void;
  }) => {
    if (view?.kind === 'modal') {
      return (
        <button onClick={() => onCloseModal?.()}>close-from-plugin</button>
      );
    }
    return (
      <button onClick={() => onOpenModal?.('confirm', { name: 'pod-1' })}>
        open-from-plugin
      </button>
    );
  },
}));

import { PluginPage } from '../../pages/PluginPage';

describe('PluginPage plugin modals', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts a modal overlay when the plugin opens one, and closes it', () => {
    render(<PluginPage />);

    // No overlay initially.
    expect(document.querySelector('.plugin-modal-overlay')).toBeNull();

    // Plugin opens a modal.
    fireEvent.click(screen.getByText('open-from-plugin'));
    expect(document.querySelector('.plugin-modal-overlay')).not.toBeNull();
    expect(
      document.querySelector(
        '.plugin-modal-dialog [role], .plugin-modal-dialog'
      )
    ).not.toBeNull();

    // The modal frame can close itself.
    fireEvent.click(screen.getByText('close-from-plugin'));
    expect(document.querySelector('.plugin-modal-overlay')).toBeNull();
  });

  it('closes the modal when the backdrop is clicked', () => {
    render(<PluginPage />);
    fireEvent.click(screen.getByText('open-from-plugin'));

    const overlay = document.querySelector(
      '.plugin-modal-overlay'
    ) as HTMLElement;
    expect(overlay).not.toBeNull();

    // Click the backdrop itself (not the dialog).
    fireEvent.click(overlay);
    expect(document.querySelector('.plugin-modal-overlay')).toBeNull();
  });
});
