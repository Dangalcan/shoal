import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Box, List, Shield, Activity, Search, RefreshCw, Loader2, AlertCircle, Gauge, Database, Terminal, Globe, Settings, X, Check, Eye, FileCode, Lock, FileText, ChevronUp, ChevronDown } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { LogViewerModal } from '../components/LogViewerModal'
import { DescribeModal } from '../components/DescribeModal'
import { YamlModal } from '../components/YamlModal'

type ResourceType = 'pods' | 'deployments' | 'services' | 'statefulsets' | 'hpa' | 'persistentvolumeclaim' | 'ingress' | 'secrets' | 'configmap'

interface ColumnDef {
    id: string;
    label: string;
    minWidth: number;
}

export function ClusterDetails() {
    const { name } = useParams<{ name: string }>()
    const navigate = useNavigate()
    const [namespaces, setNamespaces] = useState<string[]>([])
    const [selectedNamespace, setSelectedNamespace] = useState<string>('all')
    const [activeTab, setActiveTab] = useState<ResourceType>('pods')
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Log Viewer State
    const [selectedPod, setSelectedPod] = useState<{ name: string; ns: string } | null>(null)
    const [isLogModalOpen, setIsLogModalOpen] = useState(false)

    // Describe Modal State
    const [describeTarget, setDescribeTarget] = useState<{ name: string; ns: string; type: ResourceType } | null>(null)
    const [isDescribeModalOpen, setIsDescribeModalOpen] = useState(false)

    // YAML Modal State
    const [yamlTarget, setYamlTarget] = useState<{ name: string; ns: string; type: ResourceType } | null>(null)
    const [isYamlModalOpen, setIsYamlModalOpen] = useState(false)

    // Resource Visibility State
    const [visibleResources, setVisibleResources] = useState<ResourceType[]>(() => {
        const defaults: ResourceType[] = ['pods', 'deployments', 'services', 'statefulsets', 'hpa', 'persistentvolumeclaim', 'ingress', 'secrets', 'configmap']
        const saved = localStorage.getItem('k8s_desktop_visible_resources')
        if (!saved) return defaults
        try {
            const parsed = JSON.parse(saved)
            // Merge defaults to ensure new resources are available even if the user has old saved settings
            const missing = defaults.filter(d => !parsed.includes(d))
            return [...parsed, ...missing] as ResourceType[]
        } catch {
            return defaults
        }
    })
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

    // Advanced Table State
    const [visibleColumns, setVisibleColumns] = useState<Record<ResourceType, string[]>>(() => {
        const defaults: Record<ResourceType, string[]> = {
            pods: ['namespace', 'name', 'status', 'restarts', 'age'],
            deployments: ['namespace', 'name', 'ready', 'updated', 'age'],
            services: ['namespace', 'name', 'type', 'cluster-ip', 'external-ip', 'ports', 'age'],
            statefulsets: ['namespace', 'name', 'ready', 'age'],
            hpa: ['namespace', 'name', 'reference', 'targets', 'minpods', 'maxpods', 'replicas', 'age'],
            persistentvolumeclaim: ['namespace', 'name', 'status', 'volume', 'capacity', 'access-modes', 'storageclass', 'vac', 'age'],
            ingress: ['namespace', 'name', 'class', 'hosts', 'address', 'ports', 'age'],
            secrets: ['namespace', 'name', 'type', 'data', 'age'],
            configmap: ['namespace', 'name', 'data', 'age']
        }
        const saved = localStorage.getItem('k8s_desktop_visible_columns')
        if (!saved) return defaults
        try {
            const parsed = JSON.parse(saved)
            return { ...defaults, ...parsed }
        } catch {
            return defaults
        }
    })

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        const saved = localStorage.getItem('k8s_desktop_column_widths')
        return saved ? JSON.parse(saved) : {}
    })

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
    const [resizing, setResizing] = useState<{ id: string; startX: number; startWidth: number } | null>(null)

    useEffect(() => {
        localStorage.setItem('k8s_desktop_visible_resources', JSON.stringify(visibleResources))
    }, [visibleResources])

    useEffect(() => {
        localStorage.setItem('k8s_desktop_visible_columns', JSON.stringify(visibleColumns))
    }, [visibleColumns])

    useEffect(() => {
        localStorage.setItem('k8s_desktop_column_widths', JSON.stringify(columnWidths))
    }, [columnWidths])

    // Handle Resize Logic
    useEffect(() => {
        if (!resizing) return

        const handleMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - resizing.startX
            const newWidth = Math.max(50, resizing.startWidth + delta)
            setColumnWidths(prev => ({
                ...prev,
                [resizing.id]: newWidth
            }))
        }

        const handleMouseUp = () => {
            setResizing(null)
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [resizing])

    // Handle inactive visible tab
    useEffect(() => {
        if (!visibleResources.includes(activeTab)) {
            const nextTab = visibleResources.length > 0 ? visibleResources[0] : 'pods'
            setActiveTab(nextTab)
        }
    }, [visibleResources, activeTab])

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

    const handleRestart = async (resourceName: string, namespace: string, type: ResourceType) => {
        if (!name) return
        const toastId = toast.loading(`Restarting ${type}/${resourceName}...`)
        try {
            const result = await window.electron.rolloutRestart({
                contextName: name,
                resourceType: type,
                resourceName,
                namespace
            })
            if (result.success) {
                toast.success(`${type}/${resourceName} restarted successfully`, { id: toastId })
                setTimeout(fetchData, 2000)
            } else {
                toast.error(`Failed to restart: ${result.error}`, { id: toastId })
            }
        } catch (err: any) {
            toast.error(`Error: ${err.message}`, { id: toastId })
        }
    }

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
            }
            return { key, direction: 'asc' }
        })
    }

    const getSortedItems = () => {
        if (!sortConfig) return items

        return [...items].sort((a, b) => {
            let valA: any = ''
            let valB: any = ''

            // Extract values based on key
            switch (sortConfig.key) {
                case 'name':
                    valA = a.metadata.name
                    valB = b.metadata.name
                    break
                case 'namespace':
                    valA = a.metadata.namespace
                    valB = b.metadata.namespace
                    break
                case 'age':
                    valA = new Date(a.metadata.creationTimestamp).getTime()
                    valB = new Date(b.metadata.creationTimestamp).getTime()
                    break
                case 'status':
                    if (activeTab === 'pods') {
                        valA = a.status.phase
                        valB = b.status.phase
                    } else if (activeTab === 'persistentvolumeclaim') {
                        valA = a.status.phase
                        valB = b.status.phase
                    }
                    break
                case 'restarts':
                    valA = a.status.containerStatuses?.reduce((acc: number, c: any) => acc + c.restartCount, 0) || 0
                    valB = b.status.containerStatuses?.reduce((acc: number, c: any) => acc + c.restartCount, 0) || 0
                    break
                case 'ready':
                    valA = a.status.readyReplicas || 0
                    valB = b.status.readyReplicas || 0
                    break
                case 'updated':
                    valA = a.status.updatedReplicas || 0
                    valB = b.status.updatedReplicas || 0
                    break
                case 'data':
                    valA = Object.keys(a.data || {}).length
                    valB = Object.keys(b.data || {}).length
                    break
                default:
                    // For other columns, try to find the value (simplified)
                    valA = a[sortConfig.key] || ''
                    valB = b[sortConfig.key] || ''
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
            return 0
        })
    }

    const sortedItems = getSortedItems()

    useEffect(() => {
        fetchData()
    }, [name, activeTab, selectedNamespace])

    const allTabs: { id: ResourceType; label: string; icon: any }[] = [
        { id: 'pods', label: 'Pods', icon: Box },
        { id: 'deployments', label: 'Deployments', icon: Activity },
        { id: 'services', label: 'Services', icon: Shield },
        { id: 'statefulsets', label: 'StatefulSets', icon: List },
        { id: 'hpa', label: 'HPAs', icon: Gauge },
        { id: 'persistentvolumeclaim', label: 'PVCs', icon: Database },
        { id: 'ingress', label: 'Ingresses', icon: Globe },
        { id: 'secrets', label: 'Secrets', icon: Lock },
        { id: 'configmap', label: 'ConfigMaps', icon: FileText }
    ]

    const columnDefinitions: Record<ResourceType, ColumnDef[]> = {
        pods: [
            { id: 'namespace', label: 'Namespace', minWidth: 120 },
            { id: 'name', label: 'Name', minWidth: 200 },
            { id: 'status', label: 'Status', minWidth: 100 },
            { id: 'restarts', label: 'Restarts', minWidth: 80 },
            { id: 'age', label: 'Age', minWidth: 150 }
        ],
        deployments: [
            { id: 'namespace', label: 'Namespace', minWidth: 120 },
            { id: 'name', label: 'Name', minWidth: 200 },
            { id: 'ready', label: 'Ready', minWidth: 100 },
            { id: 'updated', label: 'Up-To-Date', minWidth: 100 },
            { id: 'age', label: 'Age', minWidth: 150 }
        ],
        services: [
            { id: 'namespace', label: 'Namespace', minWidth: 120 },
            { id: 'name', label: 'Name', minWidth: 200 },
            { id: 'type', label: 'Type', minWidth: 100 },
            { id: 'cluster-ip', label: 'Cluster IP', minWidth: 150 },
            { id: 'external-ip', label: 'External IP', minWidth: 150 },
            { id: 'ports', label: 'Port(s)', minWidth: 150 },
            { id: 'age', label: 'Age', minWidth: 150 }
        ],
        statefulsets: [
            { id: 'namespace', label: 'Namespace', minWidth: 120 },
            { id: 'name', label: 'Name', minWidth: 200 },
            { id: 'ready', label: 'Ready', minWidth: 100 },
            { id: 'age', label: 'Age', minWidth: 150 }
        ],
        hpa: [
            { id: 'namespace', label: 'Namespace', minWidth: 120 },
            { id: 'name', label: 'Name', minWidth: 200 },
            { id: 'reference', label: 'Reference', minWidth: 200 },
            { id: 'targets', label: 'Targets', minWidth: 150 },
            { id: 'minpods', label: 'MinPods', minWidth: 80 },
            { id: 'maxpods', label: 'MaxPods', minWidth: 80 },
            { id: 'replicas', label: 'Replicas', minWidth: 80 },
            { id: 'age', label: 'Age', minWidth: 150 }
        ],
        persistentvolumeclaim: [
            { id: 'namespace', label: 'Namespace', minWidth: 120 },
            { id: 'name', label: 'Name', minWidth: 200 },
            { id: 'status', label: 'Status', minWidth: 100 },
            { id: 'volume', label: 'Volume', minWidth: 150 },
            { id: 'capacity', label: 'Capacity', minWidth: 100 },
            { id: 'access-modes', label: 'Access Modes', minWidth: 150 },
            { id: 'storageclass', label: 'StorageClass', minWidth: 150 },
            { id: 'vac', label: 'VolumeAttributesClass', minWidth: 150 },
            { id: 'age', label: 'Age', minWidth: 150 }
        ],
        ingress: [
            { id: 'namespace', label: 'Namespace', minWidth: 120 },
            { id: 'name', label: 'Name', minWidth: 200 },
            { id: 'class', label: 'Class', minWidth: 120 },
            { id: 'hosts', label: 'Hosts', minWidth: 200 },
            { id: 'address', label: 'Address', minWidth: 150 },
            { id: 'ports', label: 'Ports', minWidth: 100 },
            { id: 'age', label: 'Age', minWidth: 150 }
        ],
        secrets: [
            { id: 'namespace', label: 'Namespace', minWidth: 120 },
            { id: 'name', label: 'Name', minWidth: 200 },
            { id: 'type', label: 'Type', minWidth: 150 },
            { id: 'data', label: 'Data', minWidth: 80 },
            { id: 'age', label: 'Age', minWidth: 150 }
        ],
        configmap: [
            { id: 'namespace', label: 'Namespace', minWidth: 120 },
            { id: 'name', label: 'Name', minWidth: 200 },
            { id: 'data', label: 'Data', minWidth: 80 },
            { id: 'age', label: 'Age', minWidth: 150 }
        ]
    }

    const tabs = allTabs.filter(tab => visibleResources.includes(tab.id))

    const toggleResource = (id: ResourceType) => {
        setVisibleResources(prev =>
            prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
        )
    }

    const toggleColumn = (resourceType: ResourceType, columnId: string) => {
        setVisibleColumns(prev => {
            const current = prev[resourceType]
            const updated = current.includes(columnId)
                ? (current.length > 1 ? current.filter(id => id !== columnId) : current) // Prevent hiding all columns
                : [...current, columnId]
            return { ...prev, [resourceType]: updated }
        })
    }

    const getColumnWidth = (id: string, defWidth: number) => {
        const key = `${activeTab}-${id}`
        return columnWidths[key] || defWidth
    }

    const startResize = (e: React.MouseEvent, id: string, currentWidth: number) => {
        e.preventDefault()
        setResizing({
            id: `${activeTab}-${id}`,
            startX: e.clientX,
            startWidth: currentWidth
        })
    }

    return (
        <div className={`min-h-full flex flex-col bg-slate-50 ${resizing ? 'select-none' : ''}`}>
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
                            title="Refresh"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                className={`p-2 border rounded-lg transition-all ${isSettingsOpen ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300'}`}
                                title="Visible Resources"
                            >
                                <Settings size={18} />
                            </button>

                            {isSettingsOpen && (
                                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-2 animate-in fade-in zoom-in duration-200">
                                    <div className="flex items-center justify-between px-3 py-2 mb-1 border-b border-slate-50">
                                        <span className="text-sm font-bold text-slate-700">Display Settings</span>
                                        <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600">
                                            <X size={14} />
                                        </button>
                                    </div>
                                    <div className="max-h-[70vh] overflow-y-auto">
                                        <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Resources</div>
                                        <div className="space-y-1 mb-4">
                                            {allTabs.map(tab => (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => toggleResource(tab.id)}
                                                    className="w-full flex items-center justify-between px-3 py-1.5 text-sm rounded-lg hover:bg-slate-50 transition-colors group"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <tab.icon size={14} className="text-slate-400" />
                                                        <span className={visibleResources.includes(tab.id) ? 'text-slate-900 font-medium' : 'text-slate-400'}>{tab.label}</span>
                                                    </div>
                                                    {visibleResources.includes(tab.id) && (
                                                        <Check size={14} className="text-blue-500" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-t border-slate-50 pt-4">Columns for {activeTab}</div>
                                        <div className="space-y-1">
                                            {columnDefinitions[activeTab].map(col => (
                                                <button
                                                    key={col.id}
                                                    onClick={() => toggleColumn(activeTab, col.id)}
                                                    className="w-full flex items-center justify-between px-3 py-1.5 text-sm rounded-lg hover:bg-slate-50 transition-colors group"
                                                >
                                                    <span className={visibleColumns[activeTab]?.includes(col.id) ? 'text-slate-900 font-medium' : 'text-slate-400'}>{col.label}</span>
                                                    {visibleColumns[activeTab]?.includes(col.id) && (
                                                        <Check size={14} className="text-blue-500" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
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
                        <div className="overflow-x-auto">
                            <table className="w-full text-left table-fixed" style={{ width: 'max-content', minWidth: '100%' }}>
                                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    <tr>
                                        {columnDefinitions[activeTab].map(col => {
                                            if (!visibleColumns[activeTab]?.includes(col.id)) return null
                                            const width = getColumnWidth(col.id, col.minWidth)
                                            const isSorted = sortConfig?.key === col.id
                                            return (
                                                <th
                                                    key={col.id}
                                                    className="px-6 py-4 relative group select-none cursor-pointer hover:bg-slate-100 transition-colors"
                                                    style={{ width: `${width}px` }}
                                                    onClick={() => handleSort(col.id)}
                                                >
                                                    <div className="flex items-center gap-1 pr-2 truncate">
                                                        <span>{col.label}</span>
                                                        {isSorted && (
                                                            sortConfig.direction === 'asc' ? <ChevronUp size={14} className="text-blue-500" /> : <ChevronDown size={14} className="text-blue-500" />
                                                        )}
                                                    </div>
                                                    <div
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation()
                                                            startResize(e, col.id, width)
                                                        }}
                                                        className={`absolute right-[-4px] top-0 bottom-0 w-3 cursor-col-resize z-10 transition-colors hover:bg-blue-400/30 ${resizing?.id === `${activeTab}-${col.id}` ? 'bg-blue-500' : 'bg-transparent'}`}
                                                    >
                                                        <div className={`absolute right-[5px] top-1/4 bottom-1/4 w-[2px] rounded-full transition-colors ${resizing?.id === `${activeTab}-${col.id}` ? 'bg-white' : 'group-hover:bg-blue-400'}`} />
                                                    </div>
                                                </th>
                                            )
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedItems.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors border-b border-slate-100 group/row">
                                            {visibleColumns[activeTab]?.includes('namespace') && (
                                                <td className="px-6 py-4 text-sm font-mono text-slate-500 truncate" style={{ width: `${getColumnWidth('namespace', 120)}px` }}>{item.metadata.namespace}</td>
                                            )}
                                            {visibleColumns[activeTab]?.includes('name') && (
                                                <td className="px-6 py-4 text-sm font-bold text-slate-900 truncate" style={{ width: `${getColumnWidth('name', 200)}px` }} title={item.metadata.name}>
                                                    <div className="flex items-center gap-2 group/row">
                                                        {activeTab === 'pods' ? (
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedPod({ name: item.metadata.name, ns: item.metadata.namespace })
                                                                    setIsLogModalOpen(true)
                                                                }}
                                                                className="flex items-center gap-2 hover:text-blue-600 group transition-colors text-left truncate flex-1"
                                                            >
                                                                <span className="truncate">{item.metadata.name}</span>
                                                                <Terminal size={14} className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-blue-400" />
                                                            </button>
                                                        ) : (
                                                            <span className="truncate flex-1">{item.metadata.name}</span>
                                                        )}
                                                        <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-all">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setDescribeTarget({ name: item.metadata.name, ns: item.metadata.namespace, type: activeTab })
                                                                    setIsDescribeModalOpen(true)
                                                                }}
                                                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-500 transition-colors"
                                                                title="Describe Resource"
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setYamlTarget({ name: item.metadata.name, ns: item.metadata.namespace, type: activeTab })
                                                                    setIsYamlModalOpen(true)
                                                                }}
                                                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-purple-500 transition-colors"
                                                                title="View YAML"
                                                            >
                                                                <FileCode size={14} />
                                                            </button>
                                                            {(activeTab === 'deployments' || activeTab === 'statefulsets') && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleRestart(item.metadata.name, item.metadata.namespace, activeTab)
                                                                    }}
                                                                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-green-500 transition-colors"
                                                                    title="Rollout Restart"
                                                                >
                                                                    <RefreshCw size={14} />
                                                                </button>
                                                            )}
                                                            {activeTab === 'pods' && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setSelectedPod({ name: item.metadata.name, ns: item.metadata.namespace })
                                                                        setIsLogModalOpen(true)
                                                                    }}
                                                                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-500 transition-colors"
                                                                    title="View Logs"
                                                                >
                                                                    <Terminal size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            )}
                                            {activeTab === 'pods' && visibleColumns.pods.includes('status') && (
                                                <td className="px-6 py-4" style={{ width: `${getColumnWidth('status', 100)}px` }}>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.status.phase === 'Running' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                        }`}>
                                                        {item.status.phase}
                                                    </span>
                                                </td>
                                            )}
                                            {activeTab === 'pods' && visibleColumns.pods.includes('restarts') && (
                                                <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('restarts', 80)}px` }}>
                                                    {item.status.containerStatuses?.reduce((acc: number, c: any) => acc + c.restartCount, 0) || 0}
                                                </td>
                                            )}
                                            {activeTab === 'services' && (
                                                <>
                                                    {visibleColumns.services.includes('type') && <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('type', 100)}px` }}>{item.spec.type}</td>}
                                                    {visibleColumns.services.includes('cluster-ip') && <td className="px-6 py-4 text-sm font-mono text-slate-500 truncate" style={{ width: `${getColumnWidth('cluster-ip', 150)}px` }}>{item.spec.clusterIP}</td>}
                                                    {visibleColumns.services.includes('external-ip') && <td className="px-6 py-4 text-sm font-mono text-slate-500 truncate" style={{ width: `${getColumnWidth('external-ip', 150)}px` }}>{item.status.loadBalancer?.ingress?.[0]?.ip || item.status.loadBalancer?.ingress?.[0]?.hostname || '<none>'}</td>}
                                                    {visibleColumns.services.includes('ports') && <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('ports', 150)}px` }}>{item.spec.ports?.map((p: any) => `${p.port}/${p.protocol}`).join(', ') || '<none>'}</td>}
                                                </>
                                            )}
                                            {(activeTab === 'deployments' || activeTab === 'statefulsets') && visibleColumns[activeTab].includes('ready') && (
                                                <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('ready', 100)}px` }}>
                                                    {item.status.readyReplicas || 0} / {item.status.replicas || 0}
                                                </td>
                                            )}
                                            {activeTab === 'deployments' && visibleColumns.deployments.includes('updated') && (
                                                <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('updated', 100)}px` }}>
                                                    {item.status.updatedReplicas || 0}
                                                </td>
                                            )}
                                            {activeTab === 'hpa' && (
                                                <>
                                                    {visibleColumns.hpa.includes('reference') && <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('reference', 200)}px` }}>{item.spec.scaleTargetRef?.kind}/{item.spec.scaleTargetRef?.name}</td>}
                                                    {visibleColumns.hpa.includes('targets') && (
                                                        <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('targets', 150)}px` }}>
                                                            {item.status.currentMetrics?.[0]?.resource?.current?.averageUtilization ??
                                                                item.status.currentCPUUtilizationPercentage ?? '0'}% / {
                                                                item.spec.metrics?.[0]?.resource?.target?.averageUtilization ??
                                                                item.spec.targetCPUUtilizationPercentage ?? '0'}%
                                                        </td>
                                                    )}
                                                    {visibleColumns.hpa.includes('minpods') && <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('minpods', 80)}px` }}>{item.spec.minReplicas ?? item.spec.minReplicas}</td>}
                                                    {visibleColumns.hpa.includes('maxpods') && <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('maxpods', 80)}px` }}>{item.spec.maxReplicas}</td>}
                                                    {visibleColumns.hpa.includes('replicas') && <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('replicas', 80)}px` }}>{item.status.currentReplicas || 0}</td>}
                                                </>
                                            )}
                                            {activeTab === 'persistentvolumeclaim' && (
                                                <>
                                                    {visibleColumns.persistentvolumeclaim.includes('status') && (
                                                        <td className="px-6 py-4" style={{ width: `${getColumnWidth('status', 100)}px` }}>
                                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.status.phase === 'Bound' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                                }`}>
                                                                {item.status.phase}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {visibleColumns.persistentvolumeclaim.includes('volume') && <td className="px-6 py-4 text-sm font-mono text-slate-500 truncate" style={{ width: `${getColumnWidth('volume', 150)}px` }}>{item.spec.volumeName || '<pending>'}</td>}
                                                    {visibleColumns.persistentvolumeclaim.includes('capacity') && <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('capacity', 100)}px` }}>{item.status.capacity?.storage || 'N/A'}</td>}
                                                    {visibleColumns.persistentvolumeclaim.includes('access-modes') && <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('access-modes', 150)}px` }}>{item.spec.accessModes?.join(', ')}</td>}
                                                    {visibleColumns.persistentvolumeclaim.includes('storageclass') && <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('storageclass', 150)}px` }}>{item.spec.storageClassName}</td>}
                                                    {visibleColumns.persistentvolumeclaim.includes('vac') && <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('vac', 150)}px` }}>{item.spec.volumeAttributesClassName || '<none>'}</td>}
                                                </>
                                            )}
                                            {activeTab === 'ingress' && (
                                                <>
                                                    {visibleColumns.ingress.includes('class') && (
                                                        <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('class', 120)}px` }}>
                                                            {item.spec.ingressClassName || item.metadata.annotations?.['kubernetes.io/ingress.class'] || '<none>'}
                                                        </td>
                                                    )}
                                                    {visibleColumns.ingress.includes('hosts') && (
                                                        <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('hosts', 200)}px` }}>
                                                            {item.spec.rules?.map((r: any) => r.host).filter(Boolean).join(', ') || '*'}
                                                        </td>
                                                    )}
                                                    {visibleColumns.ingress.includes('address') && (
                                                        <td className="px-6 py-4 text-sm font-mono text-slate-500 truncate" style={{ width: `${getColumnWidth('address', 150)}px` }}>
                                                            {item.status.loadBalancer?.ingress?.map((i: any) => i.ip || i.hostname).filter(Boolean).join(', ') || '<pending>'}
                                                        </td>
                                                    )}
                                                    {visibleColumns.ingress.includes('ports') && (
                                                        <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('ports', 100)}px` }}>
                                                            {item.spec.tls ? '80, 443' : '80'}
                                                        </td>
                                                    )}
                                                </>
                                            )}
                                            {activeTab === 'secrets' && (
                                                <>
                                                    {visibleColumns.secrets?.includes('type') && <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('type', 150)}px` }}>{item.type}</td>}
                                                    {visibleColumns.secrets?.includes('data') && <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('data', 80)}px` }}>{Object.keys(item.data || {}).length}</td>}
                                                </>
                                            )}
                                            {activeTab === 'configmap' && (
                                                <>
                                                    {visibleColumns.configmap?.includes('data') && <td className="px-6 py-4 text-sm text-slate-600 truncate" style={{ width: `${getColumnWidth('data', 80)}px` }}>{Object.keys(item.data || {}).length}</td>}
                                                </>
                                            )}
                                            {visibleColumns[activeTab]?.includes('age') && (
                                                <td className="px-6 py-4 text-sm text-slate-400 truncate" style={{ width: `${getColumnWidth('age', 150)}px` }}>
                                                    {new Date(item.metadata.creationTimestamp).toLocaleString()}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                        <Box size={48} className="mb-4 text-slate-200" />
                        <p className="text-lg font-medium">No {activeTab} found</p>
                        <p className="text-sm">In namespace: {selectedNamespace}</p>
                    </div>
                )}
            </main>

            <LogViewerModal
                isOpen={isLogModalOpen}
                onClose={() => setIsLogModalOpen(false)}
                clusterName={name || ''}
                podName={selectedPod?.name || ''}
                namespace={selectedPod?.ns || ''}
            />
            <DescribeModal
                isOpen={isDescribeModalOpen}
                onClose={() => setIsDescribeModalOpen(false)}
                clusterName={name || ''}
                resourceName={describeTarget?.name || ''}
                resourceType={describeTarget?.type || activeTab}
                namespace={describeTarget?.ns || ''}
            />
            <YamlModal
                isOpen={isYamlModalOpen}
                onClose={() => setIsYamlModalOpen(false)}
                clusterName={name || ''}
                resourceName={yamlTarget?.name || ''}
                resourceType={yamlTarget?.type || activeTab}
                namespace={yamlTarget?.ns || ''}
            />
            <Toaster position="bottom-right" richColors />
        </div>
    )
}
