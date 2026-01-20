import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dashboard } from '../../pages/Dashboard';
import { render, screen, fireEvent, waitFor, mockElectronAPI } from '../utils';
import { mockClusterState, mockToolStatus } from '../helpers/electron-helpers';
import { expectMultipleOccurrences, findByTextWithTimeout } from '../helpers/dom-helpers';
import { TEST_TIMEOUTS } from '../constants';

// Note: PodViewerModal is mocked globally in component-mocks.tsx



describe('Dashboard Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default happy path
        mockClusterState([], 'None');
        mockElectronAPI.checkTool.mockResolvedValue(true);
    });

    it('should render dashboard header', async () => {
        render(<Dashboard />)
        await waitFor(() => {
            expect(screen.getByText('Dashboard')).toBeInTheDocument()
            expect(screen.getByText('Overview of your container infrastructure.')).toBeInTheDocument()
        })
    })

    it('should fetch and display tool status (Docker/Podman)', async () => {
        mockToolStatus({ docker: true, podman: false });

        render(<Dashboard />);

        await waitFor(() => {
            expect(screen.getByText('Docker Status')).toBeInTheDocument();
            expect(mockElectronAPI.checkTool).toHaveBeenCalledWith('docker');
            expect(mockElectronAPI.checkTool).toHaveBeenCalledWith('podman');
        });
    });

    it('should fetch and display cluster stats', async () => {
        mockClusterState(['c1', 'c2'], 'c1');

        render(<Dashboard />);

        await findByTextWithTimeout('Active Context');
        await expectMultipleOccurrences('c1', 1);
        await findByTextWithTimeout('Total Contexts');
        await findByTextWithTimeout('2');
    });

    // ... (create cluster test)

    it('should render cluster list with active/available badges', async () => {
        mockClusterState(['active-cluster', 'other-cluster'], 'active-cluster');

        render(<Dashboard />);

        await expectMultipleOccurrences('active-cluster', 1);
        await findByTextWithTimeout('other-cluster');
        
        const listItems = await screen.findAllByRole('listitem');
        const activeRow = listItems.find(li => li.textContent?.includes('active-cluster'));
        expect(activeRow).toBeDefined();
        expect(activeRow).toHaveTextContent(/Active/i);
        
        await findByTextWithTimeout('Active');
        await findByTextWithTimeout('Available');
    });

    it('should navigate to cluster details', async () => {
        mockClusterState(['nav-cluster']);
        render(<Dashboard />);
        await findByTextWithTimeout('nav-cluster');

        const clusterContent = screen.getByText('nav-cluster').closest('.cluster-item-content')!;
        fireEvent.click(clusterContent);
    });

    it('should open pod viewer modal', async () => {
        mockClusterState(['view-cluster'], 'view-cluster');
        
        render(<Dashboard />);
        await expectMultipleOccurrences('view-cluster', 1);

        const viewBtn = screen.getByTitle('View Pods');
        expect(viewBtn).toBeInTheDocument();
        fireEvent.click(viewBtn);

        expect(await screen.findByTestId('pod-modal', {}, { timeout: TEST_TIMEOUTS.NETWORK_REQUEST })).toBeInTheDocument();
        expect(screen.getByText(/PodViewer for view-cluster/)).toBeInTheDocument();

        fireEvent.click(screen.getByText('Close'));
        await waitFor(() => expect(screen.queryByTestId('pod-modal')).not.toBeInTheDocument());
    });

    it('should refresh data on button click', async () => {
        render(<Dashboard />);
        
        await waitFor(() => expect(mockElectronAPI.getClusters).toHaveBeenCalledTimes(1));

        const rBtn = screen.getByTitle('Refresh Data');
        
        fireEvent.click(rBtn);
        await waitFor(() => expect(mockElectronAPI.getClusters).toHaveBeenCalledTimes(2));
    });

    it('should handle empty clusters list', async () => {
        mockClusterState([]);
        render(<Dashboard />);
        
        await waitFor(() => {
            expect(screen.getByText('No active clusters found')).toBeInTheDocument();
        });
    });

    it('should handle tool status check failure (graceful degradation)', async () => {
         mockElectronAPI.checkTool.mockRejectedValue(new Error('Tool check failed'));
         
         render(<Dashboard />);
    });
});
