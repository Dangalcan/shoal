
import { describe, it, expect } from 'vitest'
import { render, screen } from '../test-utils'
import { Sidebar } from '../../components/Sidebar'

describe('Sidebar', () => {
    it('should render application title', () => {
        render(<Sidebar />)
        expect(screen.getByText('K8s Desktop')).toBeInTheDocument()
    })

    it('should render all navigation links', () => {
        render(<Sidebar />)
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Clusters')).toBeInTheDocument()
        expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('should highlight active link', () => {
        // Render at /clusters route to check active state
        render(<Sidebar />, { initialEntries: ['/clusters'] })
        
        const clusterLink = screen.getByText('Clusters').closest('a')
        expect(clusterLink).toHaveClass('sidebar-link-active')
        
        const dashboardLink = screen.getByText('Dashboard').closest('a')
        expect(dashboardLink).toHaveClass('sidebar-link-inactive')
    })
    
    it('should show version in footer', () => {
        render(<Sidebar />)
        expect(screen.getByText(/v0.1.0/)).toBeInTheDocument()
    })
})
