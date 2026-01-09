import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { CreateCluster } from '../CreateCluster'

const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
)

describe('CreateCluster Page', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should render create cluster form', () => {
        render(<CreateCluster />, { wrapper: RouterWrapper })

        expect(screen.getByRole('heading', { name: /create cluster/i })).toBeInTheDocument()
        expect(screen.getByText(/configure your new kubernetes cluster/i)).toBeInTheDocument()
        expect(screen.getByPlaceholderText('my-cluster')).toBeInTheDocument()
    })

    it('should have kind selected as default provider', () => {
        render(<CreateCluster />, { wrapper: RouterWrapper })

        const kindButton = screen.getByRole('button', { name: /kind/i })
        expect(kindButton).toHaveClass('border-blue-600')
    })

    it('should update cluster name input', async () => {
        const user = userEvent.setup()
        render(<CreateCluster />, { wrapper: RouterWrapper })

        const input = screen.getByPlaceholderText('my-cluster')
        await user.type(input, 'test-cluster')

        expect(input).toHaveValue('test-cluster')
    })

    it('should switch provider when clicked', async () => {
        const user = userEvent.setup()
        render(<CreateCluster />, { wrapper: RouterWrapper })

        const k3dButton = screen.getByRole('button', { name: /k3d/i })
        await user.click(k3dButton)

        expect(k3dButton).toHaveClass('border-blue-600')
    })

    it('should handle form submission', async () => {
        const user = userEvent.setup()
        const consoleSpy = vi.spyOn(console, 'log')

        render(<CreateCluster />, { wrapper: RouterWrapper })

        const input = screen.getByPlaceholderText('my-cluster')
        await user.type(input, 'my-new-cluster')

        const submitButton = screen.getByRole('button', { name: /create cluster/i })
        await user.click(submitButton)

        expect(consoleSpy).toHaveBeenCalledWith('Creating cluster:', {
            name: 'my-new-cluster',
            provider: 'kind',
        })
    })

    it('should require cluster name', async () => {
        const user = userEvent.setup()
        render(<CreateCluster />, { wrapper: RouterWrapper })

        const submitButton = screen.getByRole('button', { name: /create cluster/i })
        await user.click(submitButton)

        const input = screen.getByPlaceholderText('my-cluster')
        expect(input).toBeInvalid()
    })

    it('should render both provider options', () => {
        render(<CreateCluster />, { wrapper: RouterWrapper })

        expect(screen.getByRole('button', { name: /kind/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /k3d/i })).toBeInTheDocument()
    })

    it('should have cancel button', () => {
        render(<CreateCluster />, { wrapper: RouterWrapper })

        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
})
