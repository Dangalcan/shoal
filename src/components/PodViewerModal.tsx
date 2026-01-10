import { useEffect, useState } from 'react'
import { X, Box, Loader2, AlertCircle } from 'lucide-react'
import './PodViewerModal.css'

interface PodViewerModalProps {
    isOpen: boolean
    onClose: () => void
    clusterName: string
}

export function PodViewerModal({ isOpen, onClose, clusterName }: PodViewerModalProps) {
    const [pods, setPods] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen && clusterName) {
            setLoading(true)
            setError(null)
            window.electron.getPods(clusterName)
                .then(result => {
                    if (result.success) {
                        setPods(result.pods || [])
                    } else {
                        setError(result.error || 'Failed to fetch pods')
                    }
                })
                .finally(() => setLoading(false))
        }
    }, [isOpen, clusterName])

    if (!isOpen) return null

    return (
        <div className="pod-modal-overlay">
            <div className="pod-modal-container">
                <header className="pod-modal-header">
                    <div>
                        <h3 className="pod-header-title">Pods in {clusterName}</h3>
                        <p className="pod-header-subtitle">Pods from all namespaces</p>
                    </div>
                    <button onClick={onClose} className="pod-close-button">
                        <X size={20} className="pod-close-icon" />
                    </button>
                </header>

                <div className="pod-modal-content">
                    {loading ? (
                        <div className="pod-loading-state">
                            <Loader2 className="pod-loading-spinner" size={32} />
                            <p>Fetching pods details...</p>
                        </div>
                    ) : error ? (
                        <div className="pod-error-state">
                            <AlertCircle size={32} className="pod-error-icon" />
                            <p className="pod-error-title">Error</p>
                            <p className="pod-error-message">{error}</p>
                        </div>
                    ) : pods.length > 0 ? (
                        <div className="pod-table-container">
                            <table className="pod-table">
                                <thead className="pod-table-head">
                                    <tr>
                                        <th>Namespace</th>
                                        <th>Name</th>
                                        <th>Status</th>
                                        <th>Ready</th>
                                    </tr>
                                </thead>
                                <tbody className="pod-table-body">
                                    {pods.map((pod, idx) => {
                                        const status = pod.status.phase
                                        const isRunning = status === 'Running'
                                        const readyCount = pod.status.containerStatuses?.filter((s: any) => s.ready).length || 0
                                        const totalCount = pod.spec.containers.length

                                        return (
                                            <tr key={idx} className="pod-table-row">
                                                <td className="pod-table-namespace">{pod.metadata.namespace}</td>
                                                <td className="pod-table-name" title={pod.metadata.name}>{pod.metadata.name}</td>
                                                <td className="pod-table-status">
                                                    <span className={`pod-status-badge ${isRunning ? 'pod-status-running' : 'pod-status-other'}`}>
                                                        {status}
                                                    </span>
                                                </td>
                                                <td className="pod-table-ready">
                                                    {readyCount}/{totalCount}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="pod-empty-state">
                            <Box size={48} className="pod-empty-icon" />
                            <p>No pods found in this context.</p>
                        </div>
                    )}
                </div>

                <footer className="pod-modal-footer">
                    <button onClick={onClose} className="pod-footer-close-button">
                        Close
                    </button>
                </footer>
            </div>
        </div>
    )
}
