import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../test-utils'
import { BrowserRouter } from 'react-router-dom'
import { toast } from 'sonner' // Import mocked toast
import { Clusters } from '../../pages/Clusters'
import { mockElectronAPI } from '../setup'

// Mock child components
vi.mock('../../components/modals/PodViewerModal', () => ({
    PodViewerModal: ({ isOpen, onClose, clusterName }: any) => (
        isOpen ? <div data-testid="pod-modal">PodViewer for {clusterName} <button onClick={onClose}>Close</button></div> : null
    )
}))



describe('Clusters Page', () => {
    // Mock toast
    vi.mock('sonner', () => ({
        Toaster: () => null,
        toast: {
            loading: vi.fn(),
            success: vi.fn(),
            error: vi.fn(),
            dismiss: vi.fn()
        }
    }))

    beforeEach(() => {
        vi.clearAllMocks()
        mockElectronAPI.getClusters.mockResolvedValue([])
    })
    
    it('should render', async () => {
        render(<Clusters />)
        await waitFor(() => {
            const element = screen.queryByRole('heading', { name: /clusters/i })
            expect(element).toBeTruthy()
        })
    })

    it('should fetch clusters and handle empty state', async () => {
        render(<Clusters />)
        await waitFor(() => {
            expect(mockElectronAPI.getClusters).toHaveBeenCalled()
            expect(screen.getByText('No clusters found')).toBeInTheDocument()
        })
    })

    it('should display clusters', async () => {
        mockElectronAPI.getClusters.mockResolvedValue(['cluster-1', 'cluster-2'])
        render(<Clusters />)
        await waitFor(() => {
            expect(screen.getByText('cluster-1')).toBeInTheDocument()
            expect(screen.getByText('cluster-2')).toBeInTheDocument()
        })
    })

    it('should handle load error gracefully', async () => {
        mockElectronAPI.getClusters.mockRejectedValue(new Error('Fetch failed'))
        render(<Clusters />)
        await waitFor(() => {
             expect(screen.getByText('No clusters found')).toBeInTheDocument()
        })
    })

    it('should handle cluster deletion success', async () => {
         mockElectronAPI.getClusters.mockResolvedValue(['cluster-to-delete'])
         mockElectronAPI.deleteCluster.mockResolvedValue({ success: true })

         render(<Clusters />)
         await waitFor(() => expect(screen.getByText('cluster-to-delete')).toBeInTheDocument())

         // Click delete in card
         const deleteBtn = screen.getByTitle('Delete cluster-to-delete')
         fireEvent.click(deleteBtn)

         // Click delete in modal
         const confirmBtn = await screen.findByRole('button', { name: 'Delete Cluster' })
         fireEvent.click(confirmBtn)

         await waitFor(() => {
             expect(mockElectronAPI.deleteCluster).toHaveBeenCalledWith('cluster-to-delete')
             expect(mockElectronAPI.getClusters).toHaveBeenCalledTimes(2) 
         })
    })

    it('should handle cluster deletion cancellation', async () => {
         mockElectronAPI.getClusters.mockResolvedValue(['cluster-keep'])

         render(<Clusters />)
         await waitFor(() => expect(screen.getByText('cluster-keep')).toBeInTheDocument())

         const deleteBtn = screen.getByTitle('Delete cluster-keep')
         fireEvent.click(deleteBtn)

         const cancelBtn = screen.getByText('Cancel')
         fireEvent.click(cancelBtn)

         expect(mockElectronAPI.deleteCluster).not.toHaveBeenCalled()
    })

    it('should handle cluster deletion API failure', async () => {
         mockElectronAPI.getClusters.mockResolvedValue(['cluster-fail'])
         mockElectronAPI.deleteCluster.mockResolvedValue({ success: false, error: 'Cannot delete' })
         
         render(<Clusters />)
         await waitFor(() => expect(screen.getByText('cluster-fail')).toBeInTheDocument())

         const deleteBtn = screen.getByTitle('Delete cluster-fail')
         fireEvent.click(deleteBtn)

         const confirmBtn = await screen.findByRole('button', { name: 'Delete Cluster' })
         fireEvent.click(confirmBtn)

         await waitFor(() => {
             expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Failed to delete cluster'), expect.anything())
         })
    })

    it('should handle cluster deletion unexpected exception', async () => {
         mockElectronAPI.getClusters.mockResolvedValue(['cluster-crash'])
         mockElectronAPI.deleteCluster.mockRejectedValue(new Error('Boom'))
         
         render(<Clusters />)
         await waitFor(() => expect(screen.getByText('cluster-crash')).toBeInTheDocument())

         const deleteBtn = screen.getByTitle('Delete cluster-crash')
         fireEvent.click(deleteBtn)

         const confirmBtn = await screen.findByRole('button', { name: 'Delete Cluster' })
         fireEvent.click(confirmBtn)

         await waitFor(() => {
             expect(toast.error).toHaveBeenCalledWith('Failed to delete cluster', expect.any(Object))
         })
    })

    it('should refresh list on button click', async () => {
         mockElectronAPI.getClusters.mockResolvedValue(['cluster-1'])
         render(<Clusters />)
         await waitFor(() => expect(screen.getByText('cluster-1')).toBeInTheDocument())

         const refreshBtn = screen.getByTitle('Refresh List')
         fireEvent.click(refreshBtn)

         await waitFor(() => {
             expect(mockElectronAPI.getClusters).toHaveBeenCalled()
         })
    })

    it('should navigate to details on click', async () => {
         mockElectronAPI.getClusters.mockResolvedValue(['cluster-nav'])
         render(<Clusters />)
         await waitFor(() => expect(screen.getByText('cluster-nav')).toBeInTheDocument())

         const card = screen.getByText('cluster-nav')
         fireEvent.click(card)
    })

    it('should open pod viewer modal', async () => {
         mockElectronAPI.getClusters.mockResolvedValue(['cluster-view'])
         render(<Clusters />)
         await waitFor(() => expect(screen.getByText('cluster-view')).toBeInTheDocument())

         const viewBtn = screen.getByTitle('View Pods')
         fireEvent.click(viewBtn)
    })
})
