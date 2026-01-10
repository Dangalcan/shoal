import { useEffect, useState, useRef } from 'react'
import { X, RefreshCw, Loader2, AlertCircle, Terminal } from 'lucide-react'
import './LogViewerModal.css'

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

    if (!isOpen) return null

    return (
        <div className="log-modal-overlay">
            <div className="log-modal-container">
                <header className="log-modal-header">
                    <div className="log-header-content">
                        <div className="log-header-icon">
                            <Terminal size={18} />
                        </div>
                        <div>
                            <h3 className="log-header-title">
                                Logs: <span className="log-pod-name">{podName}</span>
                            </h3>
                            <p className="log-header-subtitle">NS: {namespace} | Cluster: {clusterName}</p>
                        </div>
                    </div>
                    <div className="log-header-actions">
                        <button
                            onClick={fetchLogs}
                            disabled={loading}
                            className="log-refresh-button"
                            title="Refresh Logs"
                        >
                            <RefreshCw size={18} className={loading ? 'log-refresh-spinner' : ''} />
                        </button>
                        <button onClick={onClose} className="log-close-button">
                            <X size={18} />
                        </button>
                    </div>
                </header>

                <div className="log-modal-content">
                    {loading && !logs ? (
                        <div className="log-loading-state">
                            <Loader2 className="log-loading-spinner" size={32} />
                            <p>Fetching logs...</p>
                        </div>
                    ) : error ? (
                        <div className="log-error-state">
                            <AlertCircle size={32} className="log-error-icon" />
                            <p className="log-error-title">Failed to load logs</p>
                            <p className="log-error-message">{error}</p>
                        </div>
                    ) : (
                        <div className="log-content-text">
                            {logs}
                            <div ref={logEndRef} />
                        </div>
                    )}
                </div>

                <footer className="log-modal-footer">
                    <p className="log-footer-info">
                        End of stream (tail: 200)
                    </p>
                    <button onClick={onClose} className="log-footer-close-button">
                        Close Viewer
                    </button>
                </footer>
            </div>
        </div>
    )
}
