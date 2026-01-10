import { useEffect, useState, useRef } from 'react'
import { RefreshCw, Loader2, AlertCircle, Terminal } from 'lucide-react'
import { BaseModal } from './BaseModal'

interface LogViewerModalProps {
    isOpen: boolean
    onClose: () => void
    clusterName: string
    podName: string
    namespace: string
}

export function LogViewerModal({ isOpen, onClose, clusterName, podName, namespace }: LogViewerModalProps) {
    const [logs, setLogs] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const logEndRef = useRef<HTMLDivElement>(null)

    const fetchLogs = async () => {
        if (!podName || !namespace || !clusterName) return
        setLoading(true)
        setError(null)
        try {
            const result = await window.electron.getLogs({
                contextName: clusterName,
                podName,
                namespace
            })
            if (result.success) {
                setLogs(result.logs || 'No logs found.')
            } else {
                setError(result.error || 'Failed to fetch logs')
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isOpen) {
            fetchLogs()
        }
    }, [isOpen, podName, namespace, clusterName])

    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs])

    const headerActions = (
        <button
            onClick={fetchLogs}
            disabled={loading}
            className="modal-action-button"
            title="Refresh Logs"
        >
            <RefreshCw size={18} className={loading ? 'spinner' : ''} />
        </button>
    )

    const footerContent = (
        <>
            <p className="modal-footer-info modal-footer-info-accent">
                End of stream (tail: 200)
            </p>
            <button onClick={onClose} className="close-footer-button">
                Close Viewer
            </button>
        </>
    )

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title={`Logs: ${podName}`}
            subtitle={`NS: ${namespace} | Cluster: ${clusterName}`}
            icon={<Terminal size={18} />}
            headerActions={headerActions}
            footer={footerContent}
            className="log-modal"
            width="90%"
            maxWidth="1200px"
            data-testid="log-modal"
        >
            {loading && !logs ? (
                <div className="state-container">
                    <Loader2 className="spinner" size={32} />
                    <p>Fetching logs...</p>
                </div>
            ) : error ? (
                <div className="state-container">
                    <AlertCircle size={32} className="log-error-icon" />
                    <p className="error-title">Failed to load logs</p>
                    <p className="error-message">{error}</p>
                </div>
            ) : (
                <div className="log-content-text code-block">
                    {logs}
                    <div ref={logEndRef} />
                </div>
            )}
        </BaseModal>
    )
}
