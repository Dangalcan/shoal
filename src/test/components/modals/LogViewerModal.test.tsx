import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// Unmock component for unit testing
vi.unmock('../../../components/modals/LogViewerModal')

import { render, screen, waitFor, fireEvent } from '../../test-utils'
import { LogViewerModal } from '../../../components/modals/LogViewerModal'
import { mockElectronAPI } from '../../setup'

describe('LogViewerModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Element.prototype.scrollIntoView = vi.fn()
        mockElectronAPI.getLogs.mockResolvedValue({
            success: true,
            data: 'Test logs',
        })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should not render when closed', () => {
        const { container } = render(
            <LogViewerModal
                isOpen={false}
                onClose={vi.fn()}
                clusterName="test"
                podName="test"
                namespace="default"
            />
        )
        expect(container.firstChild).toBeNull()
    })

    it('should call getLogs API when open', async () => {
        mockElectronAPI.getLogs.mockResolvedValue({
            success: true,
            data: 'Test logs',
        })

        render(
            <LogViewerModal
                isOpen={true}
                onClose={vi.fn()}
                clusterName="test-cluster"
                podName="test-pod"
                namespace="default"
            />
        )

        await waitFor(() => {
            expect(window.electron.getLogs).toHaveBeenCalledWith(expect.objectContaining({
            contextName: 'test-cluster',
            podName: 'test-pod',
            namespace: 'default',
            tailLines: 200
        }))
        })
        expect(await screen.findByText('Test logs', {}, { timeout: 3000 })).toBeInTheDocument()
    })

    it('should display error when getLogs fails', async () => {
        mockElectronAPI.getLogs.mockResolvedValueOnce({
            success: false,
            error: 'Failed to fetch logs'
        })

        render(
            <LogViewerModal
                isOpen={true}
                onClose={vi.fn()}
                clusterName="test-cluster"
                podName="test-pod"
                namespace="default"
            />
        )

        await waitFor(() => {
            expect(screen.getByText('Failed to fetch logs')).toBeInTheDocument()
        })
    })

    it('should toggle auto-refresh', async () => {
        vi.useFakeTimers()
        render(
            <LogViewerModal
                isOpen={true}
                onClose={vi.fn()}
                clusterName="test-cluster"
                podName="test-pod"
                namespace="default"
            />
        )

        const autoRefreshBtn = screen.getByRole('button', { name: /auto-refresh/i })
        // Click to enable
        fireEvent.click(autoRefreshBtn)
        expect(autoRefreshBtn).toHaveClass('active')

        // Fast forward time
        await vi.advanceTimersByTimeAsync(5500)
        
        // Should have called getLogs again (initial + 1 interval)
        // Note: initial call is 1, interval is 1. Total 2.
        // We verify call count > 1
        expect(window.electron.getLogs).toHaveBeenCalledTimes(2)

        // Click to disable
        fireEvent.click(autoRefreshBtn)
        expect(autoRefreshBtn).not.toHaveClass('active')
        
        vi.useRealTimers()
    })

    it('should filter logs based on search query', async () => {
         mockElectronAPI.getLogs.mockResolvedValue({
            success: true,
            data: 'Error: Something went wrong\nInfo: Server started\nWarning: Low memory',
        })

        render(
            <LogViewerModal
                isOpen={true}
                onClose={vi.fn()}
                clusterName="test-cluster"
                podName="test-pod"
                namespace="default"
            />
        )

        // Wait for logs to load
        await screen.findByText('Info: Server started', { exact: false }, { timeout: 3000 })

        const { act } = await import('@testing-library/react')
        const searchInput = screen.getByPlaceholderText('Filter logs...')
        
        act(() => {
            fireEvent.change(searchInput, { target: { value: 'Error' } })
        })

        // Wait for 'Info' to disappear (filtering applied)
        await waitFor(() => {
            expect(screen.queryByText('Info: Server started', { exact: false })).not.toBeInTheDocument()
        })
        
        expect(screen.getByText('Error: Something went wrong', { exact: false })).toBeInTheDocument()
    })
    
     it('should display empty message when no logs', async () => {
        mockElectronAPI.getLogs.mockResolvedValue({
            success: true,
            data: '',
        })

        render(
            <LogViewerModal
                isOpen={true}
                onClose={vi.fn()}
                clusterName="test-cluster"
                podName="test-pod"
                namespace="default"
            />
        )
        
        // Component sets "No logs found." fallback when logs are empty string
        expect(await screen.findByText('No logs found.', {}, { timeout: 3000 })).toBeInTheDocument()
    })
})
