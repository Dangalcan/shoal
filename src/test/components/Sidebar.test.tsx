import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '../utils'
import { Sidebar } from '../../components/Sidebar'

const mockToggleTheme = vi.fn();
vi.mock('../../hooks', async () => {
    const actual = await vi.importActual('../../hooks');
    return {
        ...actual,
        useTheme: () => ({
            theme: 'light',
            toggleTheme: mockToggleTheme
        })
    };
});

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
})
