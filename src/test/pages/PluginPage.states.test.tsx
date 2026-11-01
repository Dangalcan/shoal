import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Plugin } from '../../../electron/types/plugin-types';

const state = vi.hoisted(() => ({
  plugins: [] as Plugin[],
  loading: false,
  pluginId: 'p1' as string | undefined,
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ pluginId: state.pluginId }),
  useNavigate: () => state.navigate,
}));

vi.mock('../../features/plugins/PluginProvider', () => ({
  usePlugins: () => ({ plugins: state.plugins, loading: state.loading }),
}));

// Stub the sandboxed frame so we can assert its presence and drive onTitle.
vi.mock('../../features/plugins/sandbox/PluginFrame', () => ({
  PluginFrame: ({ onTitle }: { onTitle?: (t: string) => void }) => (
    <button data-testid="plugin-frame" onClick={() => onTitle?.('Set Title')}>
      frame
    </button>
  ),
}));

vi.mock('../../features/plugins/sandbox/PluginModalHost', () => ({
  PluginModalHost: () => <div data-testid="modal-host" />,
}));

// Pass-through by default; one test makes it report "nothing to mount".
vi.mock('../../features/plugins/sandbox/frame-props', async (importActual) => {
  const actual =
    await importActual<
      typeof import('../../features/plugins/sandbox/frame-props')
    >();
  return {
    ...actual,
    buildPluginFrameUrls: vi.fn(actual.buildPluginFrameUrls),
  };
});

import { PluginPage } from '../../pages/PluginPage';
import { buildPluginFrameUrls } from '../../features/plugins/sandbox/frame-props';

function makePlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    manifest: {
      id: 'p1',
      name: 'Plugin One',
      version: '1.0.0',
      description: '',
      author: '',
      license: { spdx: 'MIT' },
      permissions: ['ui'],
    },
    state: 'enabled',
    installedAt: '2026-01-01T00:00:00Z',
    rendererEntry: '/plugins/p1/renderer.js',
    rendererStyles: [],
    ...overrides,
  } as Plugin;
}

describe('PluginPage states', () => {
  beforeEach(() => {
    state.plugins = [makePlugin()];
    state.loading = false;
    state.pluginId = 'p1';
    state.navigate.mockClear();
  });

  afterEach(() => {
    // Back to the pass-through implementation given to vi.fn().
    vi.mocked(buildPluginFrameUrls).mockReset();
  });

  it('shows a spinner while plugins are loading', () => {
    state.loading = true;
    const { container } = render(<PluginPage />);
    expect(container.querySelector('.spinner')).not.toBeNull();
  });

  it('shows "Plugin Not Active" and navigates to /plugins when the plugin is missing', () => {
    state.plugins = [];
    render(<PluginPage />);
    expect(screen.getByText('Plugin Not Active')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Manage Plugins'));
    expect(state.navigate).toHaveBeenCalledWith('/plugins');
  });

  it('treats a disabled plugin as not active', () => {
    state.plugins = [makePlugin({ state: 'disabled' })];
    render(<PluginPage />);
    expect(screen.getByText('Plugin Not Active')).toBeInTheDocument();
  });

  it('shows "No UI to Show" and navigates home when the plugin has no renderer', () => {
    state.plugins = [makePlugin({ rendererEntry: undefined })];
    render(<PluginPage />);
    expect(screen.getByText('No UI to Show')).toBeInTheDocument();
    expect(screen.getByText('Plugin One')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back to Dashboard'));
    expect(state.navigate).toHaveBeenCalledWith('/');
  });

  it('renders the plugin frame and reflects the title the plugin sets', () => {
    render(<PluginPage />);
    const frame = screen.getByTestId('plugin-frame');
    expect(frame).toBeInTheDocument();
    // No title bar until the plugin reports one.
    expect(document.querySelector('.plugin-page-title')).toBeNull();
    fireEvent.click(frame);
    expect(document.querySelector('.plugin-page-title')?.textContent).toBe(
      'Set Title'
    );
  });

  it('renders nothing when the plugin yields no frame URLs', () => {
    vi.mocked(buildPluginFrameUrls).mockReturnValue(null);
    const { container } = render(<PluginPage />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('plugin-frame')).toBeNull();
  });
});
