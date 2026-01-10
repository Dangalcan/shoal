import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../test-utils'
import { LogViewerModal } from '../../../components/modals/LogViewerModal'
import { mockElectronAPI } from '../../setup'

describe('LogViewerModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockElectronAPI.getLogs.mockResolvedValue({
            success: true,
            logs: 'Test logs',
        })
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
            expect(mockElectronAPI.getLogs).toHaveBeenCalledWith({
                contextName: 'test-cluster',
                podName: 'test-pod',
                namespace: 'default'
            })
        })
        expect(screen.getByText('Test logs')).toBeInTheDocument()
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
})
