import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '../utils'
import { Sidebar } from '../../components/Sidebar'
import { useTheme } from '../../hooks'
import { usePluginExtensions } from '../../features/plugins/PluginProvider'

const mockToggleTheme = vi.fn();
vi.mock('../../hooks', async () => {
    const actual = await vi.importActual('../../hooks');
    return {
        ...actual,
        useTheme: vi.fn(() => ({
            theme: 'light',
            toggleTheme: mockToggleTheme
        }))
    };
});

vi.mock('../../features/plugins/PluginProvider', () => ({
    PluginProvider: ({ children }: any) => children,
    usePlugins: vi.fn(() => ({ plugins: [] })),
    useEnabledPlugins: vi.fn(() => []),
    usePluginExtensions: vi.fn(() => [])
}));

describe('Sidebar', () => {
    it('should render application title', () => {
        render(<Sidebar />)
        expect(screen.getByText('K8s Desktop')).toBeInTheDocument()
    })

    it('renders navigation links', () => {
        render(<Sidebar />)
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Clusters')).toBeInTheDocument()
        expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('renders theme toggle button', () => {
        render(<Sidebar />)
        expect(screen.getByText('Dark Mode')).toBeInTheDocument()
    })

    it('calls toggleTheme when button is clicked', () => {
        render(<Sidebar />)
        fireEvent.click(screen.getByText('Dark Mode'))
        expect(mockToggleTheme).toHaveBeenCalled()
    })

    it('should highlight active link', () => {
        // Render at /clusters route to check active state
        render(<Sidebar />, { initialEntries: ['/clusters'] })
        
        const clusterLink = screen.getByText('Clusters').closest('a')
        expect(clusterLink).toHaveClass('sidebar-link-active')
        
        const dashboardLink = screen.getByText('Dashboard').closest('a')
        expect(dashboardLink).toHaveClass('sidebar-link-inactive')
    })
    
    it('should show version in footer', async () => {
        render(<Sidebar />)
        expect(await screen.findByText(/v0.1.0/)).toBeInTheDocument()
    })

    it('renders plugin extensions when present', () => {
        vi.mocked(usePluginExtensions).mockReturnValue([
            { id: 'plugin1', label: 'Plugin 1', route: '/plugin1' }
        ]);
        
        render(<Sidebar />)
        
        // Use a more specific query for the divider
        expect(screen.getByText('Plugins', { selector: '.sidebar-divider' })).toBeInTheDocument()
        expect(screen.getByText('Plugin 1')).toBeInTheDocument()
        
        const pluginLink = screen.getByText('Plugin 1').closest('a')
        expect(pluginLink).toHaveAttribute('href', '/plugin1')
    })

    it('highlights active plugin link', () => {
        vi.mocked(usePluginExtensions).mockReturnValue([
            { id: 'plugin1', label: 'Plugin 1', route: '/plugin1' }
        ]);
        
        render(<Sidebar />, { initialEntries: ['/plugin1'] })
        
        const pluginLink = screen.getByText('Plugin 1').closest('a')
        expect(pluginLink).toHaveClass('sidebar-link-active')
    })

    it('shows Light Mode when theme is dark', () => {
        vi.mocked(useTheme).mockReturnValue({
            theme: 'dark',
            toggleTheme: mockToggleTheme
        });

        render(<Sidebar />)
        expect(screen.getByText('Light Mode')).toBeInTheDocument()
    })

    it('uses default version if getAppVersion fails', async () => {
        vi.mocked(window.electron.getAppVersion).mockResolvedValue({
            success: false,
            error: 'Failed'
        });

        render(<Sidebar />)
        // Should still show v0.1.0 (default state)
        expect(await screen.findByText(/v0.1.0/)).toBeInTheDocument()
    })
})
