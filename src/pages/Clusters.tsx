import { useEffect, useState } from 'react'
import { Server, Trash2, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { Toaster, toast } from 'sonner'

export function Clusters() {
    const [clusters, setClusters] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState<string | null>(null)

    const fetchClusters = async () => {
        setLoading(true)
        try {
            const list = await window.electron.getClusters()
            setClusters(list)
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
        <div className="p-8 max-w-5xl mx-auto">
            <Toaster position="top-right" />
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Clusters</h2>
                    <p className="text-slate-500 mt-1">Manage your local Kubernetes environments.</p>
                </div>
                <button
                    onClick={fetchClusters}
                    disabled={loading}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                    title="Refresh List"
                >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </header>

            {loading && clusters.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <Loader2 className="animate-spin mb-2" size={32} />
                    <p>Loading clusters...</p>
                </div>
            ) : clusters.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                    {clusters.map((cluster) => (
                        <div key={cluster} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                    <Server size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-lg">{cluster}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                            Running
                                        </span>
                                        <span className="text-xs text-slate-400 font-mono">Provider: Kind</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleDelete(cluster)}
                                    disabled={!!deleting}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                    title="Delete Cluster"
                                >
                                    {deleting === cluster ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                    <AlertCircle size={48} className="mb-4 text-slate-300" />
                    <p className="text-lg font-medium">No clusters found</p>
                    <p className="text-sm">Create a new cluster to get started.</p>
                </div>
            )}
        </div>
    )
}
