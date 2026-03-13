import { useEffect, useState, useRef, useCallback } from 'react'
import { RefreshCw, Loader2, AlertCircle, Terminal, Search, X, Check } from 'lucide-react'
import { BaseModal } from './BaseModal'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'
import { handleError } from '../../lib/error-handler'
import { electronService } from '../../services/electronService'
import '../../../styles/components/modals/LogViewerModal.css';

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
    const [searchQuery, setSearchQuery] = useState('')
    const [autoRefresh, setAutoRefresh] = useState(false)
    const [tailLines, setTailLines] = useState(200)
    const logEndRef = useRef<HTMLDivElement>(null)
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

    const fetchLogs = useCallback(async (isAuto = false) => {
        if (!podName || !namespace || !clusterName) return
        if (!isAuto) setLoading(true)
        setError(null)
        try {
            const result = await electronService.getLogs({
                contextName: clusterName,
                podName,
                namespace,
                tailLines
            })
            if (result.success) {
                setLogs(result.data || 'No logs found.')
            } else {
                const errorMessage = result.error
                setError(errorMessage)
                handleError(new Error(errorMessage), 'Log Fetch Failed')
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred')
            handleError(err as Error, 'Log Streaming Error')
        } finally {
            if (!isAuto) setLoading(false)
        }
    }, [podName, namespace, clusterName, tailLines])

    useEffect(() => {
        if (isOpen) {
            fetchLogs()
        }
    }, [isOpen, fetchLogs])

    useEffect(() => {
        if (isOpen && autoRefresh) {
            refreshIntervalRef.current = setInterval(() => fetchLogs(true), 5000)
        } else {
            if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
        }
        return () => {
          if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
        }
    }, [isOpen, autoRefresh, fetchLogs])

    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs])

    const filteredLogs = logs
        .split('\n')
        .filter(line => line.toLowerCase().includes(searchQuery.toLowerCase()))
        .join('\n')

    const headerActions = (
        <div className="log-header-actions">
            <div className="log-search-container">
                <Search size={14} className="log-search-icon" />
                <input
                    type="text"
                    placeholder="Filter logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="log-search-input"
                />
                {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="search-clear">
                        <X size={14} />
                    </button>
                )}
            </div>
            <div className="log-refresh-controls">
                <button
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={cn("auto-refresh-toggle", autoRefresh && "active")}
                    title="Auto-refresh (5s)"
                >
                    {autoRefresh ? <Check size={14} /> : null}
                    <span>Auto-refresh</span>
                </button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => fetchLogs()}
                    loading={loading}
                    title="Refresh Now"
                >
                    <RefreshCw size={18} />
                </Button>
            </div>
        </div>
    )

    const footerContent = (
        <>
            <p className="modal-footer-info modal-footer-info-accent">
                End of stream (tail: {tailLines})
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
                <div className="log-viewer-body">
                    <div className="log-content-text code-block">
                        {filteredLogs || (searchQuery ? 'No matches found.' : 'No logs.')}
                        <div ref={logEndRef} />
                    </div>
                </div>
            )}
        </BaseModal>
    )
}
