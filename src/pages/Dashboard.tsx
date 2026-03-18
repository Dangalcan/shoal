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
import { useClusterContext } from '../features/clusters/ClusterContext';
import { Button, Badge, Card, Animate } from '../components/ui';
import { useApi } from '../services/api-context';
import { isSuccess } from '../types/result';
import { cn } from '../lib/utils';
import { usePluginWidgets } from '../services/plugin-ui-registry';

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
        <div className="stat-card-info">
          <p className="stat-card-label">{label}</p>
          <div className="stat-card-value-container">
            {status ? (
              <Badge 
                variant={status === 'running' ? 'success' : 'error'} 
                dot 
                className="stat-card-badge"
                title={String(value)}
              >
                {value}
              </Badge>
            ) : (
              <p className="stat-card-value" title={String(value)}>{value}</p>
            )}
          </div>
        </div>
        <div className={`stat-card-icon-container ${colorClass}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const api = useApi();
  const { clusters, currentContext, fetchClusters, loading: clustersLoading } = useClusterContext();
  const [dockerStatus, setDockerStatus] = useState<boolean | null>(null);
  const [podmanStatus, setPodmanStatus] = useState<boolean | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const widgets = usePluginWidgets();

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const [dockerRes, podmanRes] = await Promise.all([
        api.checkTool('docker').catch(err => ({ success: false as const, error: String(err) })),
        api.checkTool('podman').catch(err => ({ success: false as const, error: String(err) }))
      ]);
      setDockerStatus(isSuccess(dockerRes) ? dockerRes.data : false);
      setPodmanStatus(isSuccess(podmanRes) ? podmanRes.data : false);
      await fetchClusters();
    } finally {
      setLoading(false);
    }
  }, [api, fetchClusters]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const dashboardLoading = loading || clustersLoading;
  const activeContext = currentContext || 'None';

  return (
    <div className="dashboard-container">
      <Animate type="fade">
        <header className="dashboard-header">
          <h2 className="dashboard-title">Dashboard</h2>
          <p className="dashboard-subtitle">
            Overview of your container infrastructure.
          </p>
        </header>
      </Animate>

      <div className="stats-grid">
        <Animate type="slide-up" delay={0}>
          <StatCard
            label="Docker Status"
            value={dockerStatus === null ? 'Checking...' : dockerStatus ? 'Running' : 'Not Found'}
            icon={Box}
            color={dockerStatus ? 'blue' : 'red'}
            status={dockerStatus ? 'running' : 'stopped'}
          />
        </Animate>
        <Animate type="slide-up" delay={100}>
          <StatCard
            label="Podman Status"
            value={podmanStatus === null ? 'Checking...' : podmanStatus ? 'Running' : 'Not Found'}
            icon={Box}
            color={podmanStatus ? 'purple' : 'orange'}
            status={podmanStatus ? 'running' : 'stopped'}
          />
        </Animate>
        <Animate type="slide-up" delay={200}>
          <StatCard
            label="Active Context"
            value={activeContext}
            icon={Server}
            color="blue"
          />
        </Animate>
        <Animate type="slide-up" delay={300}>
          <StatCard
            label="Total Contexts"
            value={clusters.length}
            icon={Box}
            color="green"
          />
        </Animate>
      </div>

      <div className="content-grid">
        <Animate type="slide-up" delay={400}>
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
              <Button 
                variant="secondary" 
                className="w-full"
                onClick={() => navigate('/clusters')}
              >
                Manage Existing Clusters
              </Button>
            </div>
          </Card>
        </Animate>

        <Animate type="slide-up" delay={500}>
          <Card 
            title="Recent Activity"
            headerAction={
              <Button variant="ghost" size="icon" onClick={refreshData} loading={dashboardLoading} title="Refresh Data">
                <RefreshCw size={16} />
              </Button>
            }
          >
            {clusters.length > 0 ? (
              <ul className="cluster-list">
                {clusters.slice(0, 5).map((cluster: string) => (
                  <li
                    key={cluster}
                    className={cn(
                      "cluster-item",
                      cluster === currentContext ? 'cluster-item-active' : 'cluster-item-inactive'
                    )}
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
                        className={cn(
                          "cluster-item-name",
                          cluster === currentContext ? 'cluster-item-name-active' : 'cluster-item-name-inactive'
                        )}
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
              <div className="dashboard-empty-state">
                <Box size={32} className="text-slate-400 mb-2" />
                <p>No active clusters found</p>
              </div>
            )}
          </Card>
        </Animate>
      </div>

      {widgets.length > 0 && (
        <div className="dashboard-widgets-section">
          <Animate type="fade" delay={600}>
             <h3 className="section-title">Plugin Widgets</h3>
          </Animate>
          <div className="widgets-grid">
            {widgets.map((widget, index) => (
              <Animate key={widget.id} type="slide-up" delay={600 + (index * 100)}>
                <Card title={widget.title} className={`widget-card widget-${widget.size}`}>
                  <widget.component />
                </Card>
              </Animate>
            ))}
          </div>
        </div>
      )}

      <PodViewerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clusterName={selectedCluster || ''}
      />
    </div>
  );
}
