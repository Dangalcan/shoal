import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '../utils';
import {
  mockApi,
  mockClusters,
  renderClustersPage,
} from '../helpers/cluster-test-utils';
import { deleteClusterDialogText } from '../../features/clusters/provider';

vi.mock('../../components/modals/PodViewerModal', () => ({
  PodViewerModal: () => null,
}));

describe('delete dialog wording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClusters([]);
  });

  it('promises a deletion only for kind and k3d clusters', () => {
    expect(deleteClusterDialogText('kind-dev').confirmLabel).toBe(
      'Delete Cluster'
    );
    expect(deleteClusterDialogText('k3d-test').title).toBe('Delete Cluster');
    const remote = deleteClusterDialogText(
      'arn:aws:eks:eu-west-1:123:cluster/prod'
    );
    expect(remote.title).toBe('Remove Context');
    expect(remote.message).toMatch(/not touched/);
  });

  it('offers to remove the kubeconfig entry for a remote context', async () => {
    renderClustersPage(['kind-dev', 'prod-eks']);

    fireEvent.click(await screen.findByTitle('Delete prod-eks'));
    expect(
      await screen.findByRole('button', { name: 'Remove Context' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The cluster itself is not touched/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Context' }));
    await waitFor(() =>
      expect(mockApi.deleteCluster).toHaveBeenCalledWith('prod-eks')
    );
  });

  it('still says Delete Cluster for a kind cluster', async () => {
    renderClustersPage(['kind-dev']);

    fireEvent.click(await screen.findByTitle('Delete kind-dev'));
    expect(
      await screen.findByRole('button', { name: 'Delete Cluster' })
    ).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
  });
});
