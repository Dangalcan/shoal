import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server,
  Trash2,
  RefreshCw,
  Eye,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { Toaster } from 'sonner';
import { PodViewerModal } from '../components/modals/PodViewerModal';
import { ConfirmModal } from '../components/modals/ConfirmModal';
import { useClusters } from '../hooks';
import { Button, Badge, Spinner, Animate } from '../components/ui';
import '../../styles/pages/Clusters.css';

export function Clusters() {
  const navigate = useNavigate();
  const { clusters, loading, deleting, currentContext, switching, fetchClusters, deleteCluster, switchContext } = useClusters();

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
          {clusters.map((cluster, index) => {
            const isActive = cluster === currentContext;
            const isSwitching = switching === cluster;
            
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
                  onClick={() => navigate(`/cluster/${cluster}`)}
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
                    <Badge variant="success" dot>
                      Running
                    </Badge>
                    <span className="cluster-provider">Provider: Kind</span>
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
                    title="Set as Active Context"
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
          )})}

        </div>
      ) : (
        <Animate type="fade">
          <div className="clusters-empty">
            <div className="clusters-empty-icon">
              <Server size={48} />
            </div>
            <h3 className="clusters-empty-title">No clusters found</h3>
            <p className="clusters-empty-subtitle">
              Create a new cluster or check your local setup.
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
        title="Delete Cluster"
        message={`Are you sure you want to delete cluster "${clusterToDelete}"? This action cannot be undone.`}
        confirmLabel="Delete Cluster"
        variant="danger"
        loading={!!deleting}
      />
    </div>
  );
}
