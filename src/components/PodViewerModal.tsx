import { useEffect, useState } from 'react'
import { X, Box, Loader2, AlertCircle } from 'lucide-react'

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                <header className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Pods in {clusterName}</h3>
                        <p className="text-sm text-slate-500">Pods from all namespaces</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <Loader2 className="animate-spin mb-2" size={32} />
                            <p>Fetching pods details...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-64 text-red-500 bg-red-50 rounded-xl border border-red-100">
                            <AlertCircle size={32} className="mb-2" />
                            <p className="font-semibold">Error</p>
                            <p className="text-sm text-center px-4">{error}</p>
                        </div>
                    ) : pods.length > 0 ? (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">Namespace</th>
                                        <th className="px-4 py-3">Name</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Ready</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {pods.map((pod, idx) => {
                                        const status = pod.status.phase
                                        const isRunning = status === 'Running'
                                        const readyCount = pod.status.containerStatuses?.filter((s: any) => s.ready).length || 0
                                        const totalCount = pod.spec.containers.length

                                        return (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors text-sm">
                                                <td className="px-4 py-3 font-mono text-xs text-slate-500">{pod.metadata.namespace}</td>
                                                <td className="px-4 py-3 font-medium text-slate-900 truncate max-w-[200px]" title={pod.metadata.name}>{pod.metadata.name}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isRunning ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                        }`}>
                                                        {status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                                                    {readyCount}/{totalCount}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <Box size={48} className="mb-4 text-slate-200" />
                            <p>No pods found in this context.</p>
                        </div>
                    )}
                </div>

                <footer className="p-4 border-t border-slate-100 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium transition-colors">
                        Close
                    </button>
                </footer>
            </div>
        </div>
    )
}
