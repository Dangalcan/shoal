import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server, Box, Plus, CheckCircle, AlertCircle, RefreshCw, Eye } from 'lucide-react'
import { PodViewerModal } from '../components/PodViewerModal'
import '../../styles/pages/Dashboard.css'

function StatCard({ label, value, icon: Icon, color, status }: any) {
    const colorMap: any = {
        blue: 'stat-card-icon-blue',
        green: 'stat-card-icon-green',
        purple: 'stat-card-icon-purple',
        orange: 'stat-card-icon-orange',
        red: 'stat-card-icon-red'
    }
    const colorClass = colorMap[color] || colorMap.blue

    return (
        <div className="stat-card">
            <div className="stat-card-content">
                <div>
                    <p className="stat-card-label">{label}</p>
                    <div className="stat-card-value-container">
                        <p className="stat-card-value">{value}</p>
                        {status === 'running' && <CheckCircle className="status-icon-running" />}
                        {status === 'stopped' && <AlertCircle className="status-icon-stopped" />}
                    </div>
                </div>
                <div className={`stat-card-icon-container ${colorClass}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
        </div>
    )
}

export function Dashboard() {
    const navigate = useNavigate()
    const [dockerStatus, setDockerStatus] = useState<boolean | null>(null)
    const [podmanStatus, setPodmanStatus] = useState<boolean | null>(null)
    const [clusters, setClusters] = useState<string[]>([])
    const [currentContext, setCurrentContext] = useState<string>('None')
    const [selectedCluster, setSelectedCluster] = useState<string | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const refreshData = () => {
        window.electron.checkTool('docker').then(setDockerStatus).catch(() => setDockerStatus(null))
        window.electron.checkTool('podman').then(setPodmanStatus).catch(() => setPodmanStatus(null))
        window.electron.getClusters().then(setClusters).catch(() => setClusters([]))
        window.electron.getCurrentContext().then(setCurrentContext).catch(() => setCurrentContext('None'))
    }

    useEffect(() => {
        refreshData()
    }, [])

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h2 className="dashboard-title">Dashboard</h2>
                <p className="dashboard-subtitle">Overview of your container infrastructure.</p>
            </header>

            <div className="stats-grid">
                <StatCard
                    label="Docker Status"
                    value={dockerStatus === null ? 'Checking...' : dockerStatus ? 'Running' : 'Not Found'}
                    icon={Box}
                    color={dockerStatus ? 'blue' : 'red'}
                    status={dockerStatus ? 'running' : 'stopped'}
                />
                <StatCard
                    label="Podman Status"
                    value={podmanStatus === null ? 'Checking...' : podmanStatus ? 'Running' : 'Not Found'}
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
                <StatCard label="Total Contexts" value={clusters.length} icon={Box} color="green" />
            </div>

            <div className="content-grid">
                <div className="card">
                    <h3 className="card-title">Quick Actions</h3>
                    <div className="quick-actions">
                        <button
                            onClick={() => navigate('/create-cluster')}
                            className="primary-button">
                            <Plus size={18} />
                            Create New Cluster
                        </button>
                        <div className="divider-text">or</div>
                        <button className="secondary-button">
                            Import Existing Kubeconfig
                        </button>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Recent Activity</h3>
                        <button
                            onClick={refreshData}
                            className="refresh-button"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                    {clusters.length > 0 ? (
                        <ul className="cluster-list">
                            {clusters.map((cluster) => (
                                <li key={cluster} className={`cluster-item ${cluster === currentContext ? "cluster-item-active" : "cluster-item-inactive"}`}>
                                    <div
                                        onClick={() => navigate(`/cluster/${cluster}`)}
                                        className="cluster-item-content"
                                    >
                                        <Server size={16} className={cluster === currentContext ? "cluster-item-icon-active" : "cluster-item-icon-inactive"} />
                                        <span className={`cluster-item-name ${cluster === currentContext ? "cluster-item-name-active" : "cluster-item-name-inactive"}`}>
                                            {cluster}
                                        </span>
                                    </div>
                                    <div className="cluster-item-actions">
                                        <button
                                            onClick={() => {
                                                setSelectedCluster(cluster)
                                                setIsModalOpen(true)
                                            }}
                                            className="view-pods-button"
                                            title="View Pods"
                                        >
                                            <Eye size={14} />
                                        </button>
                                        {cluster === currentContext && (
                                            <span className="badge-active">Active</span>
                                        )}
                                        {cluster !== currentContext && (
                                            <span className="badge-available">Available</span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="empty-state">
                            <p>No active clusters found</p>
                        </div>
                    )}
                </div>
            </div>

            <PodViewerModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                clusterName={selectedCluster || ''}
            />
        </div>
    )
}
