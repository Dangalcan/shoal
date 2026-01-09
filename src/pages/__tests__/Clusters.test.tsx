import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Clusters } from '../Clusters'
import { mockElectronAPI } from '../../test/setup'

const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
)

describe('Clusters Page', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockElectronAPI.getClusters.mockResolvedValue([])
    })

    it('should render', async () => {
        render(<Clusters />, { wrapper: RouterWrapper })

        await waitFor(() => {
            // Look for the heading
            const element = screen.queryByRole('heading', { name: /clusters/i })
            expect(element).toBeTruthy()
        }, { timeout: 2000 })
    })

    it('should fetch clusters', async () => {
        render(<Clusters />, { wrapper: RouterWrapper })

        await waitFor(() => {
            expect(mockElectronAPI.getClusters).toHaveBeenCalled()
        })
    })

    it('should display clusters', async () => {
        mockElectronAPI.getClusters.mockResolvedValue(['cluster-1', 'cluster-2'])

        render(<Clusters />, { wrapper: RouterWrapper })

        await waitFor(() => {
            expect(screen.getByText('cluster-1')).toBeInTheDocument()
        }, { timeout: 2000 })
    })
})
