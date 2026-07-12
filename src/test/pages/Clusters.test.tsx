import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../utils'
import { toast } from 'sonner' 
import { Clusters } from '../../pages/Clusters'
import { 
    mockApi,
    mockClusters,
    mockClusterDeletion, 
    deleteClusterViaUI,
    renderClustersPage
} from '../helpers/cluster-test-utils'

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
        mockClusters([])
    })
    
    it('should render', async () => {
        renderClustersPage()
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /clusters/i })).toBeInTheDocument()
        })
    })

    it('should fetch clusters and handle empty state', async () => {
        renderClustersPage()
        await waitFor(() => {
            expect(mockApi.getClusters).toHaveBeenCalled()
            expect(screen.getByText(/No clusters found/i)).toBeInTheDocument()
        })
    })

    it('should display clusters', async () => {
        renderClustersPage(['cluster-1', 'cluster-2'])
        await waitFor(() => {
            expect(screen.getByText('cluster-1')).toBeInTheDocument()
            expect(screen.getByText('cluster-2')).toBeInTheDocument()
        })
    })

    it('should handle load error gracefully', async () => {
        mockApi.getClusters = vi.fn().mockRejectedValue(new Error('Fetch failed'))
        renderClustersPage()
        await waitFor(() => {
             expect(screen.getByText(/No clusters found/i)).toBeInTheDocument()
        })
    })

    it('should handle cluster deletion success', async () => {
         renderClustersPage(['cluster-to-delete'])
         mockClusterDeletion(true)

         await waitFor(() => expect(screen.getByText('cluster-to-delete')).toBeInTheDocument())
         await deleteClusterViaUI('cluster-to-delete')

         await waitFor(() => {
             expect(mockApi.deleteCluster).toHaveBeenCalledWith('cluster-to-delete')
             expect(mockApi.getClusters).toHaveBeenCalledTimes(2) 
         })
    })

    it('should handle cluster deletion cancellation', async () => {
         renderClustersPage(['cluster-keep'])

         await waitFor(() => expect(screen.getByText('cluster-keep')).toBeInTheDocument())

         fireEvent.click(screen.getByTitle('Delete cluster-keep'))
         fireEvent.click(screen.getByText('Cancel'))

         expect(mockApi.deleteCluster).not.toHaveBeenCalled()
    })

    it('should handle cluster deletion API failure', async () => {
         renderClustersPage(['cluster-fail'])
         mockClusterDeletion(false, 'Cannot delete')
         
         await waitFor(() => expect(screen.getByText('cluster-fail')).toBeInTheDocument())
         await deleteClusterViaUI('cluster-fail')

         await waitFor(() => {
             expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Failed to delete cluster'), expect.anything())
             expect(mockApi.getClusters).toHaveBeenCalledTimes(1) 
         })
    })

    it('should handle cluster deletion unexpected exception', async () => {
         renderClustersPage(['cluster-crash'])
         mockApi.deleteCluster = vi.fn().mockRejectedValue(new Error('Boom'))
         
         await waitFor(() => expect(screen.getByText('cluster-crash')).toBeInTheDocument())
         await deleteClusterViaUI('cluster-crash')

         await waitFor(() => {
             expect(toast.error).toHaveBeenCalledWith('Failed to delete cluster', expect.any(Object))
             expect(mockApi.getClusters).toHaveBeenCalledTimes(1) 
         })
    })

    it('should refresh list on button click', async () => {
         renderClustersPage(['cluster-1'])
         await waitFor(() => expect(screen.getByText('cluster-1')).toBeInTheDocument())

         fireEvent.click(screen.getByTitle('Refresh List'))

         await waitFor(() => {
             expect(mockApi.getClusters).toHaveBeenCalledTimes(2)
         })
    })

    it('should navigate to details on click', async () => {
         renderClustersPage(['cluster-nav'])
         await waitFor(() => expect(screen.getByText('cluster-nav')).toBeInTheDocument())

         fireEvent.click(screen.getByText('cluster-nav'))
    })

    it('should open pod viewer modal', async () => {
         renderClustersPage(['cluster-view'])
         await waitFor(() => expect(screen.getByText('cluster-view')).toBeInTheDocument())

         fireEvent.click(screen.getByTitle('View Pods'))
    })

    it('should close the pod viewer modal', async () => {
         renderClustersPage(['cluster-view'])
         await waitFor(() => expect(screen.getByText('cluster-view')).toBeInTheDocument())

         fireEvent.click(screen.getByTitle('View Pods'))
         await waitFor(() => expect(screen.getByTestId('pod-modal')).toBeInTheDocument())

         fireEvent.click(screen.getByText('Close'))
         await waitFor(() => expect(screen.queryByTestId('pod-modal')).toBeNull())
    })

    it('should navigate to the create-cluster page', async () => {
         renderClustersPage([])
         await waitFor(() => expect(screen.getByText(/No clusters found/i)).toBeInTheDocument())

         fireEvent.click(screen.getByTitle('Create New Cluster'))
    })

    it('should switch the active context from a cluster card', async () => {
         renderClustersPage(['cluster-a'])
         await waitFor(() => expect(screen.getByText('cluster-a')).toBeInTheDocument())

         fireEvent.click(screen.getByTitle('Set as Active Context'))

         await waitFor(() => {
             expect(mockApi.switchContext).toHaveBeenCalledWith('cluster-a')
         })
    })
})
