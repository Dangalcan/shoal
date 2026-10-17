import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server,
  Box,
  Plus,
  RefreshCw,
  Eye,
  Container,
  Layers,
  GitBranch,
} from 'lucide-react';
import { PodViewerModal } from '../components/modals/PodViewerModal';
import { useClusterContext } from '../features/clusters/ClusterContext';
import { Button, Badge, Card, Animate } from '../components/ui';
import { useApi } from '../services/api-context';
import { useAsyncData } from '../hooks/useAsyncData';
import { isSuccess } from '../types/result';
import type { Result } from '../types/result';
import { cn } from '../lib/utils';
import { DashboardWidgets } from '../features/plugins/DashboardWidgets';
import { KubectlMissingNotice } from '../features/clusters/KubectlMissingNotice';
import type { ToolStatus } from '../types.d';
import { activateOnKey } from '../lib/a11y';

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
              <p className="stat-card-value" title={String(value)}>
                {value}
              </p>
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

interface EngineStatuses {
  docker: ToolStatus;
  podman: ToolStatus;
}

/**
 * Probes both container engines at once. A probe that fails outright counts
 * as "not installed", so one broken detection never hides the other card.
 */
async function probeEngines(
  api: ReturnType<typeof useApi>
): Promise<EngineStatuses> {
  const probe = (tool: string): Promise<Result<ToolStatus>> =>
    api
      .getToolStatus(tool)
      .catch((err) => ({ success: false as const, error: String(err) }));
  const [dockerRes, podmanRes] = await Promise.all([
    probe('docker'),
    probe('podman'),
  ]);
  return {
    docker: isSuccess(dockerRes)
      ? dockerRes.data
      : { tool: 'docker', installed: false },
    podman: isSuccess(podmanRes)
      ? podmanRes.data
      : { tool: 'podman', installed: false },
  };
}

/** Stat card text for a container engine (docker/podman) probe. */
function engineLabel(status: ToolStatus | null): string {
  if (status === null) return 'Checking...';
  if (!status.installed) return 'Not installed';
  return status.running ? 'Running' : 'Stopped';
}

/**
 * Only an installed engine that is not running is a problem worth a red
 * dot; most users have Docker or Podman, not both, so "not installed" is
 * neutral.
 */
function engineState(
  status: ToolStatus | null
): 'running' | 'stopped' | undefined {
  if (status === null || !status.installed) return undefined;
  return status.running ? 'running' : 'stopped';
}

export function Dashboard() {
  const navigate = useNavigate();
  // Under the HashRouter navigate() returns nothing; the promise in its type
  // belongs to the data routers.
  const openCluster = (cluster: string) =>
    void navigate(`/cluster/${encodeURIComponent(cluster)}`);
  const api = useApi();
  const {
    clusters,
    currentContext,
    fetchClusters,
    loading: clustersLoading,
  } = useClusterContext();
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    data: engines,
    loading: enginesLoading,
    refetch: refreshEngines,
  } = useAsyncData<EngineStatuses>({
    fetchFn: () => probeEngines(api),
  });
  const dockerStatus = engines?.docker ?? null;
  const podmanStatus = engines?.podman ?? null;

  // The cluster list is refreshed every time the dashboard opens.
  useEffect(() => {
    void fetchClusters();
  }, [fetchClusters]);

  const refreshData = () => {
    void Promise.all([refreshEngines(), fetchClusters()]);
  };

  const dashboardLoading = enginesLoading || clustersLoading;
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

      <KubectlMissingNotice onRecheck={fetchClusters} />

      <div className="stats-grid">
        <Animate type="slide-up" delay={0}>
          <StatCard
            label="Docker Status"
            value={engineLabel(dockerStatus)}
            icon={Container}
            color={engineState(dockerStatus) === 'stopped' ? 'red' : 'blue'}
            status={engineState(dockerStatus)}
          />
        </Animate>
        <Animate type="slide-up" delay={100}>
          <StatCard
            label="Podman Status"
            value={engineLabel(podmanStatus)}
            icon={Layers}
            color={
              engineState(podmanStatus) === 'stopped' ? 'orange' : 'purple'
            }
            status={engineState(podmanStatus)}
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
            label="Total Clusters"
            value={clusters.length}
            icon={GitBranch}
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
            title="Your Clusters"
            headerAction={
              <Button
                variant="ghost"
                size="icon"
                onClick={refreshData}
                loading={dashboardLoading}
                title="Refresh Data"
              >
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
                      'cluster-item',
                      cluster === currentContext
                        ? 'cluster-item-active'
                        : 'cluster-item-inactive'
                    )}
                  >
                    <div
                      onClick={() => openCluster(cluster)}
                      onKeyDown={(e) =>
                        activateOnKey(e, () => openCluster(cluster))
                      }
                      role="button"
                      tabIndex={0}
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
                          'cluster-item-name',
                          cluster === currentContext
                            ? 'cluster-item-name-active'
                            : 'cluster-item-name-inactive'
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
                <Box size={32} />
                <p>No clusters found</p>
                <p className="dashboard-empty-state__hint">
                  Shoal lists the contexts of your kubeconfig. Create a local
                  cluster, or set another kubeconfig path in Settings.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() => navigate('/create-cluster')}
                >
                  Add a Cluster
                </Button>
              </div>
            )}
          </Card>
        </Animate>
      </div>

      <DashboardWidgets />

      <PodViewerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clusterName={selectedCluster || ''}
      />
    </div>
  );
}
