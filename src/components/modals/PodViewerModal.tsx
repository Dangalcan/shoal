import { useEffect, useState } from 'react'
import { Box, Loader2, AlertCircle, MoreHorizontal } from 'lucide-react'
import { BaseModal } from './BaseModal'
import { useResourceActions } from '../../services/plugin-ui-registry'
import { handleError } from '../../lib/error-handler'
import { useApi } from '../../services/api-context'

interface PodViewerModalProps {
    isOpen: boolean
    onClose: () => void
    clusterName: string
}

export function PodViewerModal({ isOpen, onClose, clusterName }: PodViewerModalProps) {
    const api = useApi()
    const [pods, setPods] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const pluginActions = useResourceActions('pod')

    useEffect(() => {
        if (isOpen && clusterName) {
            setLoading(true)
            setError(null)
            api.getPods(clusterName)
                .then(result => {
                    if (result.success) {
                        setPods(result.data || [])
                    } else {
                        const errorMessage = result.error
                        setError(errorMessage)
                        handleError(new Error(errorMessage), 'Fetch Pods Failed')
                    }
                })
                .catch(err => {
                    setError(err.message || 'An error occurred fetching pods')
                    handleError(err, 'Pods Fetch Error')
                })
                .finally(() => setLoading(false))
        }
    }, [isOpen, clusterName])

    const footerContent = (
        <button onClick={onClose} className="close-footer-button">
            Close
        </button>
    )

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title={`Pods in ${clusterName}`}
            subtitle="Pods from all namespaces"
            icon={<Box size={20} />}
            footer={footerContent}
            className="pod-modal"
            data-testid="pod-modal"
            width="90%"
            maxWidth="1200px"
        >
            {loading ? (
                <div className="state-container">
                    <Loader2 className="spinner" size={32} />
                    <p>Fetching pods details...</p>
                </div>
            ) : error ? (
                <div className="state-container">
                    <AlertCircle size={32} className="pod-error-icon" />
                    <p className="error-title">Error</p>
                    <p className="error-message">{error}</p>
                </div>
            ) : pods.length > 0 ? (
                <div className="modal-table-container">
                    <table className="modal-table">
                        <thead className="modal-table-head">
                            <tr>
                                <th>Namespace</th>
                                <th>Name</th>
                                <th>Status</th>
                                <th>Ready</th>
                            </tr>
                        </thead>
                        <tbody className="modal-table-body">
                            {pods.map((pod, idx) => {
                                const status = pod.status.phase
                                const isRunning = status === 'Running'
                                const readyCount = pod.status.containerStatuses?.filter((s: any) => s.ready).length || 0
                                const totalCount = pod.spec.containers.length
                                return (
                                    <tr key={idx} className="modal-table-row">
                                        <td className="modal-mono-cell">{pod.metadata.namespace}</td>
                                        <td title={pod.metadata.name} style={{ fontWeight: 500 }}>{pod.metadata.name}</td>
                                        <td>
                                            <span className={`status-badge ${isRunning ? 'status-badge-success' : 'status-badge-warning'}`}>
                                                {status}
                                            </span>
                                        </td>
                                        <td className="modal-mono-cell">
                                            {readyCount}/{totalCount}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="state-container">
                    <Box size={48} className="pod-empty-icon" />
                    <p>No pods found in this context.</p>
                </div>
            )}
        </BaseModal>
    )
}
