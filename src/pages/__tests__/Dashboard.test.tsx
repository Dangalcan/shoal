import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Dashboard } from '../Dashboard'
import { mockElectronAPI } from '../../test/setup'

const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
)

describe('Dashboard Page', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockElectronAPI.getClusters.mockResolvedValue([])
        mockElectronAPI.getCurrentContext.mockResolvedValue('None')
    })

    it('should render', async () => {
        render(<Dashboard />, { wrapper: RouterWrapper })

        await waitFor(() => {
            const element = screen.queryByText(/dashboard/i)
            expect(element).toBeTruthy()
        })
    })

    it('should fetch clusters and context', async () => {
        render(<Dashboard />, { wrapper: RouterWrapper })

        await waitFor(() => {
            expect(mockElectronAPI.getClusters).toHaveBeenCalled()
            expect(mockElectronAPI.getCurrentContext).toHaveBeenCalled()
        })
    })

    it('should display cluster count', async () => {
        mockElectronAPI.getClusters.mockResolvedValue(['c1', 'c2', 'c3'])

        render(<Dashboard />, { wrapper: RouterWrapper })

        await waitFor(() => {
            expect(screen.getByText('3')).toBeInTheDocument()
        })
    })
})
