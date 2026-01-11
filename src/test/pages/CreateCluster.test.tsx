
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../test-utils'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { CreateCluster } from '../../pages/CreateCluster'
import { mockElectronAPI } from '../setup'



describe('CreateCluster Page', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should render create cluster form', () => {
        render(<CreateCluster />)

        expect(screen.getByRole('heading', { name: /create cluster/i })).toBeInTheDocument()
        expect(screen.getByText(/configure your new kubernetes cluster/i)).toBeInTheDocument()
        expect(screen.getByPlaceholderText('my-cluster')).toBeInTheDocument()
    })

    it('should have kind selected as default provider', () => {
        render(<CreateCluster />)

        const kindButton = screen.getByRole('button', { name: /kind/i })
        expect(kindButton).toHaveClass('provider-button-selected')
    })

    it('should update cluster name input', async () => {
        const user = userEvent.setup()
        render(<CreateCluster />)

        const input = screen.getByPlaceholderText('my-cluster')
        await user.type(input, 'test-cluster')

        expect(input).toHaveValue('test-cluster')
    })

    it('should switch provider when clicked', async () => {
        const user = userEvent.setup()
        render(<CreateCluster />)

        const k3dButton = screen.getByRole('button', { name: /k3d/i })
        await user.click(k3dButton)

        expect(k3dButton).toHaveClass('provider-button-selected')
    })

    it('should handle form submission', async () => {
        const user = userEvent.setup()
        mockElectronAPI.createCluster.mockResolvedValue({ success: true })

        render(<CreateCluster />)

        const input = screen.getByPlaceholderText('my-cluster')
        await user.type(input, 'my-new-cluster')

        const submitButton = screen.getByRole('button', { name: /create cluster/i })
        await user.click(submitButton)

        expect(mockElectronAPI.createCluster).toHaveBeenCalledWith('my-new-cluster', 'kind')
        
        await waitFor(() => {
            expect(input).toHaveValue('')
        })
    })

    it('should require cluster name', async () => {
        const user = userEvent.setup()
        render(<CreateCluster />)

        const submitButton = screen.getByRole('button', { name: /create cluster/i })
        await user.click(submitButton)

        const input = screen.getByPlaceholderText('my-cluster')
        expect(input).toBeInvalid()
    })

    it('should render both provider options', () => {
        render(<CreateCluster />)

        expect(screen.getByRole('button', { name: /kind/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /k3d/i })).toBeInTheDocument()
    })

    it('should have cancel button', () => {
        render(<CreateCluster />)

        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
})
