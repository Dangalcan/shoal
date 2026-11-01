import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, act } from '../../utils';
import { createMockElectronAPI } from '../../utils/mocks';
import { makePlugin } from './plugin-fixtures';
import { PluginModalBridge } from '../../../features/plugins/PluginModalBridge';
import type { PluginModalData } from '../../../types';

// The modal content runs in a sandboxed iframe; stub the frame itself.
vi.mock('../../../features/plugins/sandbox/PluginFrame', () => ({
  PluginFrame: ({ view }: { view: { kind: string; modalId?: string } }) => (
    <div data-testid="plugin-frame">
      {view.kind}:{view.modalId}
    </div>
  ),
}));

describe('PluginModalBridge', () => {
  it('opens the plugin modal that main-process plugin code asked for', async () => {
    let deliver: ((data: PluginModalData) => void) | null = null;
    const api = createMockElectronAPI({
      getPlugins: vi.fn().mockResolvedValue({
        success: true,
        data: [
          makePlugin({
            state: 'enabled',
            rendererEntry: '/plugins/p1/renderer.js',
            manifest: { id: 'p1', permissions: ['ui'] },
          }),
        ],
      }),
      onPluginModal: vi.fn((cb: (data: PluginModalData) => void) => {
        deliver = cb;
        return () => {
          deliver = null;
        };
      }),
    });

    render(<PluginModalBridge />, { api });
    await waitFor(() => expect(api.getPlugins).toHaveBeenCalled());
    await waitFor(() => expect(deliver).not.toBeNull());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => {
      deliver?.({
        pluginId: 'p1',
        component: 'confirm-restart',
        props: { n: 1 },
      });
    });

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-frame')).toHaveTextContent(
      'modal:confirm-restart'
    );
  });

  it('ignores modals from plugins that have no renderer', async () => {
    let deliver: ((data: PluginModalData) => void) | null = null;
    const api = createMockElectronAPI({
      getPlugins: vi.fn().mockResolvedValue({
        success: true,
        data: [makePlugin({ manifest: { id: 'headless' } })],
      }),
      onPluginModal: vi.fn((cb: (data: PluginModalData) => void) => {
        deliver = cb;
        return () => {};
      }),
    });

    render(<PluginModalBridge />, { api });
    await waitFor(() => expect(deliver).not.toBeNull());

    act(() => {
      deliver?.({ pluginId: 'headless', component: 'x' });
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders no modal when the preload exposes no plugin-modal channel', async () => {
    // An older preload without the channel: the bridge must not subscribe.
    const api = createMockElectronAPI({ onPluginModal: undefined as never });

    const { container } = render(<PluginModalBridge />, { api });
    await waitFor(() => expect(api.getPlugins).toHaveBeenCalled());

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
