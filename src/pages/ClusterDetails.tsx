import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Box, List, Shield, Activity, Search, RefreshCw, Loader2, AlertCircle } from 'lucide-react'

type ResourceType = 'pods' | 'deployments' | 'services' | 'statefulsets'

export function ClusterDetails() {
    const { name } = useParams<{ name: string }>()
    const navigate = useNavigate()
    const [namespaces, setNamespaces] = useState<string[]>([])
    const [selectedNamespace, setSelectedNamespace] = useState<string>('all')
    const [activeTab, setActiveTab] = useState<ResourceType>('pods')
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchData = async () => {
        if (!name) return
        setLoading(true)
        setError(null)
        try {
            const nsResult = await window.electron.getNamespaces(name)
            if (nsResult.success) {
                setNamespaces(nsResult.namespaces || [])
            }

            const resResult = await window.electron.getResources({
                contextName: name,
                resourceType: activeTab,
                namespace: selectedNamespace
            })
            if (resResult.success) {
                setItems(resResult.items || [])
            } else {
                setError(resResult.error || `Failed to fetch ${activeTab}`)
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [name, activeTab, selectedNamespace])

    const tabs: { id: ResourceType; label: string; icon: any }[] = [
        { id: 'pods', label: 'Pods', icon: Box },
        { id: 'deployments', label: 'Deployments', icon: Activity },
        { id: 'services', label: 'Services', icon: Shield },
        { id: 'statefulsets', label: 'StatefulSets', icon: List }
    ]

    return (
        <div className="min-h-full flex flex-col bg-slate-50">
            <header className="bg-white border-b border-slate-200 px-8 py-6 sticky top-0 z-10">
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">{name}</h2>
                        <p className="text-sm text-slate-500">Cluster Detailed View</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600'
                                    }`}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <select
                                value={selectedNamespace}
                                onChange={(e) => setSelectedNamespace(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            >
                                <option value="all">All Namespaces</option>
                                {namespaces.map(ns => (
                                    <option key={ns} value={ns}>{ns}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-all disabled:opacity-50"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-8">
                {loading && items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Loader2 className="animate-spin mb-4" size={40} />
                        <p className="text-lg">Loading {activeTab}...</p>
                    </div>
                ) : error ? (
                    <div className="max-w-2xl mx-auto flex flex-col items-center justify-center p-12 bg-red-50 text-red-600 rounded-2xl border border-red-100">
                        <AlertCircle size={48} className="mb-4" />
                        <h3 className="text-xl font-bold mb-2">Error Loading Resources</h3>
                        <p className="text-center opacity-80 mb-6">{error}</p>
                        <button
                            onClick={fetchData}
                            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                        >
                            Try Again
                        </button>
                    </div>
                ) : items.length > 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Namespace</th>
                                    <th className="px-6 py-4">Name</th>
                                    {activeTab === 'pods' && <th className="px-6 py-4">Status</th>}
                                    {activeTab === 'services' && <th className="px-6 py-4">Type</th>}
                                    {(activeTab === 'deployments' || activeTab === 'statefulsets') && <th className="px-6 py-4">Ready</th>}
                                    <th className="px-6 py-4">Creation Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-mono text-slate-500">{item.metadata.namespace}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-900 truncate max-w-[300px]" title={item.metadata.name}>
                                            {item.metadata.name}
                                        </td>
                                        {activeTab === 'pods' && (
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.status.phase === 'Running' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                    }`}>
                                                    {item.status.phase}
                                                </span>
                                            </td>
                                        )}
                                        {activeTab === 'services' && (
                                            <td className="px-6 py-4 text-sm text-slate-600">{item.spec.type}</td>
                                        )}
                                        {(activeTab === 'deployments' || activeTab === 'statefulsets') && (
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {item.status.readyReplicas || 0} / {item.status.replicas || 0}
                                            </td>
                                        )}
                                        <td className="px-6 py-4 text-sm text-slate-400">
                                            {new Date(item.metadata.creationTimestamp).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                        <Box size={48} className="mb-4 text-slate-200" />
                        <p className="text-lg font-medium">No {activeTab} found</p>
                        <p className="text-sm">In namespace: {selectedNamespace}</p>
                    </div>
                )}
            </main>
        </div>
    )
}
