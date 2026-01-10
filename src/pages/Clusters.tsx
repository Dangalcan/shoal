import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server, Trash2, RefreshCw, Loader2, AlertCircle, Eye } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { PodViewerModal } from '../components/PodViewerModal'
import '../../styles/pages/Clusters.css'

export function Clusters() {
    const navigate = useNavigate()
    const [clusters, setClusters] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [selectedCluster, setSelectedCluster] = useState<string | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const fetchClusters = async () => {
        setLoading(true)
        try {
            const list = await window.electron.getClusters()
            setClusters(list)
        } catch (error) {
            toast.error('Failed to load clusters.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchClusters()
    }, [])

    const handleDelete = async (name: string) => {
        if (!confirm(`Are you sure you want to delete cluster "${name}"?`)) return

        setDeleting(name)
        const toastId = toast.loading(`Deleting cluster "${name}"...`)

        try {
            const result = await window.electron.deleteCluster(name)
            if (result.success) {
                toast.success(`Cluster "${name}" deleted.`, { id: toastId })
                fetchClusters()
            } else {
                toast.error(`Failed to delete cluster: ${result.error}`, { id: toastId })
            }
        } catch (err) {
            toast.error('An unexpected error occurred.', { id: toastId })
        } finally {
            setDeleting(null)
        }
    }

    return (
        <div className="clusters-container">
            <Toaster position="top-right" />
            <header className="clusters-header">
                <div>
                    <h2 className="clusters-title">Clusters</h2>
                    <p className="clusters-subtitle">Manage your local Kubernetes environments.</p>
                </div>
                <button
                    onClick={fetchClusters}
                    disabled={loading}
                    className="refresh-clusters-button"
                    title="Refresh List"
                >
                    <RefreshCw size={20} className={loading ? 'refresh-icon-spinning' : ''} />
                </button>
            </header>

            {loading && clusters.length === 0 ? (
                <div className="clusters-loading">
                    <Loader2 className="clusters-loading-spinner" size={32} />
                    <p>Loading clusters...</p>
                </div>
            ) : clusters.length > 0 ? (
                <div className="clusters-grid">
                    {clusters.map((cluster) => (
                        <div key={cluster} className="cluster-card">
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
                                        <span className="cluster-status-badge">
                                            <div className="cluster-status-dot"></div>
                                            Running
                                        </span>
                                        <span className="cluster-provider">Provider: Kind</span>
                                    </div>
                                </div>
                            </div>

                            <div className="cluster-card-actions">
                                <button
                                    onClick={() => {
                                        setSelectedCluster(cluster)
                                        setIsModalOpen(true)
                                    }}
                                    className="view-pods-action-button"
                                    title="View Pods"
                                >
                                    <Eye size={20} />
                                </button>
                                <button
                                    onClick={() => handleDelete(cluster)}
                                    disabled={!!deleting}
                                    className="delete-cluster-button"
                                    title="Delete Cluster"
                                >
                                    {deleting === cluster ? <Loader2 size={20} className="delete-spinner" /> : <Trash2 size={20} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="clusters-empty">
                    <AlertCircle size={48} className="clusters-empty-icon" />
                    <p className="clusters-empty-title">No clusters found</p>
                    <p className="clusters-empty-subtitle">Create a new cluster to get started.</p>
                </div>
            )}

            <PodViewerModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                clusterName={selectedCluster || ''}
            />
        </div>
    )
}
