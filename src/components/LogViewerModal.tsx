import { useEffect, useState, useRef } from 'react'
import { X, RefreshCw, Loader2, AlertCircle, Terminal } from 'lucide-react'

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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[#1e1e1e] rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-800 animate-in fade-in zoom-in duration-200">
                <header className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#252526]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800 text-slate-400 rounded-lg">
                            <Terminal size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                                Logs: <span className="text-blue-400 font-mono">{podName}</span>
                            </h3>
                            <p className="text-xs text-slate-500 font-mono">NS: {namespace} | Cluster: {clusterName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchLogs}
                            disabled={loading}
                            className="p-2 hover:bg-slate-800 text-slate-400 rounded-lg transition-colors disabled:opacity-50"
                            title="Refresh Logs"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-800 text-slate-400 rounded-lg transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-4 font-mono text-sm bg-[#1a1a1a]">
                    {loading && !logs ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <Loader2 className="animate-spin mb-2" size={32} />
                            <p>Fetching logs...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full text-red-500 bg-red-950/20 rounded-xl border border-red-900/30 m-4">
                            <AlertCircle size={32} className="mb-2" />
                            <p className="font-semibold">Failed to load logs</p>
                            <p className="text-xs mt-1 text-center px-8 opacity-70">{error}</p>
                        </div>
                    ) : (
                        <div className="text-slate-300 whitespace-pre-wrap break-words selection:bg-blue-500/30">
                            {logs}
                            <div ref={logEndRef} />
                        </div>
                    )}
                </div>

                <footer className="p-3 border-t border-slate-800 bg-[#252526] flex justify-between items-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold px-3">
                        End of stream (tail: 200)
                    </p>
                    <button onClick={onClose} className="px-4 py-1.5 bg-slate-800 text-slate-300 text-xs rounded hover:bg-slate-700 transition-colors">
                        Close Viewer
                    </button>
                </footer>
            </div>
        </div>
    )
}
