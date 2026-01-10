import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server,
  Box,
  Plus,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { PodViewerModal } from '../components/modals/PodViewerModal';
import { useClusters } from '../hooks';
import { Button, Badge, Spinner, Card } from '../components/ui';
import { electronService } from '../services/electronService';
import '../../styles/pages/Dashboard.css';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  status?: 'running' | 'stopped';
}

function StatCard({ label, value, icon: Icon, color, status }: StatCardProps) {
  const colorMap = {
    blue: 'stat-card-icon-blue',
    green: 'stat-card-icon-green',
    purple: 'stat-card-icon-purple',
    orange: 'stat-card-icon-orange',
    red: 'stat-card-icon-red',
  };
  const colorClass = colorMap[color];

  return (
    <div className="stat-card">
      <div className="stat-card-content">
        <div>
          <p className="stat-card-label">{label}</p>
          <div className="stat-card-value-container">
            <p className="stat-card-value">{value}</p>
            {status && (
              <Badge 
                variant={status === 'running' ? 'success' : 'error'} 
                dot 
                className="stat-card-badge"
              >
                {status === 'running' ? 'Running' : 'Stopped'}
              </Badge>
            )}
          </div>
        </div>
        <div className={`stat-card-icon-container ${colorClass}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { clusters, fetchClusters } = useClusters();
  const [dockerStatus, setDockerStatus] = useState<boolean | null>(null);
  const [podmanStatus, setPodmanStatus] = useState<boolean | null>(null);
  const [currentContext, setCurrentContext] = useState<string>('None');
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const refreshData = useCallback(() => {
    electronService
      .checkTool('docker')
      .then(setDockerStatus)
      .catch(() => setDockerStatus(null));
    electronService
      .checkTool('podman')
      .then(setPodmanStatus)
      .catch(() => setPodmanStatus(null));
    fetchClusters();
    electronService
      .getCurrentContext()
      .then(setCurrentContext)
      .catch(() => setCurrentContext('None'));
  }, [fetchClusters]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h2 className="dashboard-title">Dashboard</h2>
        <p className="dashboard-subtitle">
          Overview of your container infrastructure.
        </p>
      </header>

      <div className="stats-grid">
        <StatCard
          label="Docker Status"
          value={
            dockerStatus === null
              ? 'Checking...'
              : dockerStatus
                ? 'Running'
                : 'Not Found'
          }
          icon={Box}
          color={dockerStatus ? 'blue' : 'red'}
          status={dockerStatus ? 'running' : 'stopped'}
        />
        <StatCard
          label="Podman Status"
          value={
            podmanStatus === null
              ? 'Checking...'
              : podmanStatus
                ? 'Running'
                : 'Not Found'
          }
          icon={Box}
          color={podmanStatus ? 'purple' : 'orange'}
          status={podmanStatus ? 'running' : 'stopped'}
        />
        <StatCard
          label="Active Context"
          value={currentContext}
          icon={Server}
          color="blue"
        />
        <StatCard
          label="Total Contexts"
          value={clusters.length}
          icon={Box}
          color="green"
        />
      </div>

      <div className="content-grid">
        <Card title="Quick Actions">
          <div className="quick-actions">
            <Button
              onClick={() => navigate('/create-cluster')}
              variant="primary"
              className="w-full"
              icon={<Plus size={18} />}
            >
              Create New Cluster
            </Button>
            <div className="divider-text">or</div>
            <Button variant="secondary" className="w-full">
              Import Existing Kubeconfig
            </Button>
          </div>
        </Card>

        <Card 
          title="Recent Activity"
          headerAction={
            <Button variant="ghost" size="icon" onClick={refreshData} title="Refresh Data">
              <RefreshCw size={16} />
            </Button>
          }
        >
          {clusters.length > 0 ? (
            <ul className="cluster-list">
              {clusters.map((cluster: string) => (
                <li
                  key={cluster}
                  className={`cluster-item ${cluster === currentContext ? 'cluster-item-active' : 'cluster-item-inactive'}`}
                >
                  <div
                    onClick={() => navigate(`/cluster/${cluster}`)}
                    className="cluster-item-content"
                  >
                    <Server
                      size={16}
                      className={
                        cluster === currentContext
                          ? 'cluster-item-icon-active'
                          : 'cluster-item-icon-inactive'
                      }
                    />
                    <span
                      className={`cluster-item-name ${cluster === currentContext ? 'cluster-item-name-active' : 'cluster-item-name-inactive'}`}
                    >
                      {cluster}
                    </span>
                  </div>
                  <div className="cluster-item-actions">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedCluster(cluster);
                        setIsModalOpen(true);
                      }}
                      title="View Pods"
                    >
                      <Eye size={14} />
                    </Button>
                    {cluster === currentContext ? (
                      <Badge className="badge-active">Active</Badge>
                    ) : (
                      <Badge className="badge-available">Available</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <Spinner size={32} label="No active clusters found" />
            </div>
          )}
        </Card>
      </div>

      <PodViewerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clusterName={selectedCluster || ''}
      />
    </div>
  );
}
