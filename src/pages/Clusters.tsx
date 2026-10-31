import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server,
  Trash2,
  RefreshCw,
  Eye,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { PodViewerModal } from '../components/modals/PodViewerModal';
import { ConfirmModal } from '../components/modals/ConfirmModal';
import { useClusterContext } from '../features/clusters/ClusterContext';
import { Button, Badge, Spinner, Animate } from '../components/ui';
import { KubectlMissingNotice } from '../features/clusters/KubectlMissingNotice';
import { activateOnKey } from '../lib/a11y';
import {
  providerFromContext,
  deleteClusterDialogText,
} from '../features/clusters/provider';

export function Clusters() {
  const navigate = useNavigate();
  // Under the HashRouter navigate() returns nothing; the promise in its type
  // belongs to the data routers.
  const openCluster = (cluster: string) =>
    void navigate(`/cluster/${encodeURIComponent(cluster)}`);
  const {
    clusters,
    loading,
    deleting,
    currentContext,
    switching,
    fetchClusters,
    deleteCluster,
    switchContext,
  } = useClusterContext();

  // useAsyncData handles initial fetch on mount

  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clusterToDelete, setClusterToDelete] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!clusterToDelete) return;
    const { success } = await deleteCluster(clusterToDelete);
    if (success) {
      setClusterToDelete(null);
    }
  };

  return (
    <div className="clusters-container">
      <Animate type="slide-down">
        <header className="clusters-header">
          <div>
            <h2 className="clusters-title">Clusters</h2>
            <p className="clusters-subtitle">
              Manage your local Kubernetes environments.
            </p>
          </div>
          <div className="clusters-header-actions">
            <Button
              variant="secondary"
              size="icon"
              onClick={fetchClusters}
              loading={loading}
              title="Refresh List"
            >
              <RefreshCw size={20} />
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate('/create-cluster')}
              title="Create New Cluster"
            >
              <Plus size={20} />
              <span>Create Cluster</span>
            </Button>
          </div>
        </header>
      </Animate>

      <KubectlMissingNotice onRecheck={fetchClusters} />

      {loading && clusters.length === 0 ? (
        <Animate type="fade">
          <div className="clusters-loading">
            <Spinner size={32} label="Loading clusters..." />
          </div>
        </Animate>
      ) : clusters.length > 0 ? (
        <div className="clusters-grid">
          {clusters.map((cluster, index) => {
            const isActive = cluster === currentContext;
            const isSwitching = switching === cluster;
            const provider = providerFromContext(cluster);

            return (
              <Animate
                key={cluster}
                type="slide-up"
                delay={index * 50}
                className={`cluster-card ${isActive ? 'cluster-card--active' : ''}`}
              >
                <div className="cluster-card-content">
                  <div className="cluster-card-icon">
                    <Server size={24} />
                  </div>
                  <div
                    onClick={() => openCluster(cluster)}
                    onKeyDown={(e) =>
                      activateOnKey(e, () => openCluster(cluster))
                    }
                    role="button"
                    tabIndex={0}
                    className="cluster-card-info"
                  >
                    <div className="cluster-card-name-row">
                      <h3 className="cluster-card-name">{cluster}</h3>
                      {isActive && (
                        <Badge variant="success" dot>
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className="cluster-card-meta">
                      <span className="cluster-provider">
                        {provider
                          ? `Provider: ${provider}`
                          : 'kubeconfig context'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="cluster-card-actions">
                  {!isActive && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => switchContext(cluster)}
                      loading={isSwitching}
                      title="Set as active context (runs kubectl config use-context, so your terminal switches too)"
                    >
                      <CheckCircle2 size={20} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedCluster(cluster);
                      setIsModalOpen(true);
                    }}
                    title="View Pods"
                  >
                    <Eye size={20} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="delete-cluster-button"
                    onClick={() => setClusterToDelete(cluster)}
                    loading={deleting === cluster}
                    title={`Delete ${cluster}`}
                  >
                    <Trash2 size={20} />
                  </Button>
                </div>
              </Animate>
            );
          })}
        </div>
      ) : (
        <Animate type="fade">
          <div className="clusters-empty">
            <div className="clusters-empty-icon">
              <Server size={48} />
            </div>
            <h3 className="clusters-empty-title">No clusters found</h3>
            <p className="clusters-empty-subtitle">
              Shoal lists the contexts of your kubeconfig (
              <code>~/.kube/config</code>, or the files named in{' '}
              <code>KUBECONFIG</code>). Create a local cluster with kind or k3d,
              or point Settings → Kubeconfig Path at another file.
            </p>
          </div>
        </Animate>
      )}

      <PodViewerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clusterName={selectedCluster || ''}
      />

      <ConfirmModal
        isOpen={!!clusterToDelete}
        onClose={() => setClusterToDelete(null)}
        onConfirm={handleDelete}
        {...deleteClusterDialogText(clusterToDelete ?? '')}
        variant="danger"
        loading={!!deleting}
      />
    </div>
  );
}
