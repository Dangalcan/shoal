import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server,
  Trash2,
  RefreshCw,
  Eye,
  Plus,
} from 'lucide-react';
import { Toaster } from 'sonner';
import { PodViewerModal } from '../components/modals/PodViewerModal';
import { ConfirmModal } from '../components/modals/ConfirmModal';
import { useClusters } from '../hooks';
import { Button, Badge, Spinner, Animate } from '../components/ui';
import '../../styles/pages/Clusters.css';

export function Clusters() {
  const navigate = useNavigate();
  const { clusters, loading, deleting, fetchClusters, deleteCluster } = useClusters();

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

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
      <Toaster position="top-right" />
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

      {loading && clusters.length === 0 ? (
        <Animate type="fade">
          <div className="clusters-loading">
            <Spinner size={32} label="Loading clusters..." />
          </div>
        </Animate>
      ) : clusters.length > 0 ? (
        <div className="clusters-grid">
          {clusters.map((cluster, index) => (
            <Animate 
              key={cluster} 
              type="slide-up" 
              delay={index * 50} 
              className="cluster-card"
            >
              <div className="cluster-card-content">
                <div className="cluster-card-icon">
                  <Server size={24} />
                </div>
                <div
                  onClick={() => navigate(`/cluster/${cluster}`)}
                  className="cluster-card-info"
                >
                  <h3 className="cluster-card-name">{cluster}</h3>
                  <div className="cluster-card-meta">
                    <Badge variant="success" dot>
                      Running
                    </Badge>
                    <span className="cluster-provider">Provider: Kind</span>
                  </div>
                </div>
              </div>

              <div className="cluster-card-actions">
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
          ))}
        </div>
      ) : (
        <div className="clusters-empty">
          <Spinner size={48} className="text-slate-200" label="No clusters found" />
          <p className="clusters-empty-subtitle">
            Create a new cluster to get started.
          </p>
        </div>
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
        title="Delete Cluster"
        message={`Are you sure you want to delete cluster "${clusterToDelete}"? This action cannot be undone.`}
        confirmLabel="Delete Cluster"
        variant="danger"
        loading={!!deleting}
      />
    </div>
  );
}
