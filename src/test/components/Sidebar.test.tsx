import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, mockToast } from '../utils';
import { Sidebar } from '../../components/Sidebar';
import { useTheme } from '../../hooks';
import {
  usePluginExtensions,
  usePlugins,
} from '../../features/plugins/PluginProvider';

const mockToggleTheme = vi.fn();
vi.mock('../../hooks', async () => {
  const actual = await vi.importActual('../../hooks');
  return {
    ...actual,
    useTheme: vi.fn(() => ({
      theme: 'light',
      toggleTheme: mockToggleTheme,
    })),
  };
});

vi.mock('../../features/plugins/PluginProvider', () => ({
  PluginProvider: ({ children }: any) => children,
  usePlugins: vi.fn(() => ({ plugins: [] })),
  useEnabledPlugins: vi.fn(() => []),
  usePluginExtensions: vi.fn(() => []),
}));

describe('Sidebar', () => {
  it('should render application title', () => {
    render(<Sidebar />);
    expect(screen.getByText('Shoal')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<Sidebar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Clusters')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders theme toggle button', () => {
    render(<Sidebar />);
    expect(screen.getByText('Dark Mode')).toBeInTheDocument();
  });

  it('calls toggleTheme when button is clicked', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByText('Dark Mode'));
    expect(mockToggleTheme).toHaveBeenCalled();
  });

  it('should highlight active link', () => {
    // Render at /clusters route to check active state
    render(<Sidebar />, { initialEntries: ['/clusters'] });

    const clusterLink = screen.getByText('Clusters').closest('a');
    expect(clusterLink).toHaveClass('sidebar-link-active');

    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).toHaveClass('sidebar-link-inactive');
  });

  it('should show version in footer', async () => {
    vi.mocked(window.electron.getAppVersion).mockResolvedValue({
      success: true,
      data: 'v0.9.0',
    });

    render(<Sidebar />);
    expect(await screen.findByText('v0.9.0')).toBeInTheDocument();
  });

  it('renders plugin extensions when present', () => {
    vi.mocked(usePlugins).mockReturnValue({
      plugins: [
        { manifest: { id: 'plugin1', name: 'Plugin 1', renderer: 'index.js' } },
      ],
    } as any);
    vi.mocked(usePluginExtensions).mockReturnValue([
      { id: 'plugin1', label: 'Plugin 1', route: '/plugin/plugin1' },
    ]);

    render(<Sidebar />);

    expect(
      screen.getByText('Plugins', { selector: '.sidebar-divider' })
    ).toBeInTheDocument();
    expect(screen.getByText('Plugin 1')).toBeInTheDocument();

    const pluginLink = screen.getByText('Plugin 1').closest('a');
    expect(pluginLink).toHaveAttribute('href', '/plugin/plugin1');
  });

  it('highlights active plugin link', () => {
    vi.mocked(usePlugins).mockReturnValue({
      plugins: [
        { manifest: { id: 'plugin1', name: 'Plugin 1', renderer: 'index.js' } },
      ],
    } as any);
    vi.mocked(usePluginExtensions).mockReturnValue([
      { id: 'plugin1', label: 'Plugin 1', route: '/plugin/plugin1' },
    ]);

    render(<Sidebar />, { initialEntries: ['/plugin/plugin1'] });

    const pluginLink = screen.getByText('Plugin 1').closest('a');
    expect(pluginLink).toHaveClass('sidebar-link-active');
  });

  it('shows Light Mode when theme is dark', () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: 'dark',
      toggleTheme: mockToggleTheme,
    });

    render(<Sidebar />);
    expect(screen.getByText('Light Mode')).toBeInTheDocument();
  });

  it('shows no version if getAppVersion fails', async () => {
    vi.mocked(window.electron.getAppVersion).mockResolvedValue({
      success: false,
      error: 'Failed',
    });

    const { container } = render(<Sidebar />);
    await waitFor(() =>
      expect(window.electron.getAppVersion).toHaveBeenCalled()
    );
    expect(container.querySelector('.sidebar-version')).toHaveTextContent(/^$/);
  });

  it('reports a version request that throws', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    vi.mocked(window.electron.getAppVersion).mockRejectedValueOnce(
      new Error('ipc closed')
    );

    const { container } = render(<Sidebar />);

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to read the app version',
        expect.objectContaining({ description: 'ipc closed' })
      )
    );
    expect(container.querySelector('.sidebar-version')).toHaveTextContent(/^$/);
    consoleError.mockRestore();
  });
});
