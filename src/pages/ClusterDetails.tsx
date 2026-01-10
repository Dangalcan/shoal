import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, RefreshCw, Loader2, AlertCircle, Settings, X, Check, Box } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { LogViewerModal } from '../components/LogViewerModal'
import { DescribeModal } from '../components/DescribeModal'
import { YamlModal } from '../components/YamlModal'
import { ResourceTable } from '../components/resource-tables/ResourceTable'
import { ResourceRow } from '../components/resource-tables/ResourceRows'
import { ResourceType, ALL_TABS, COLUMN_DEFINITIONS } from '../lib/resource-definitions'
import '../../styles/pages/ClusterDetails.css'

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
        const skipResources: ResourceType[] = [
            'daemonsets', 'jobs', 'cronjobs', 'ingressclass', 'networkpolicy', 
            'endpointslices', 'serviceaccounts', 'persistentvolume', 'storageclass', 
            'volumesnapshot', 'volumesnapshotclass', 'role', 'clusterrole', 
            'rolebinding', 'clusterrolebinding', 'poddisruptionbudget', 'limitrange', 
            'resourcequota', 'priorityclass', 'runtimeclass', 'lease', 
            'customresourcedefinition', 'mutatingwebhookconfiguration', 
            'validatingwebhookconfiguration', 'apiservice', 'replicationcontroller',
            'endpoints', 'events', 'bindings', 'controllerrevisions',
            'certificatesigningrequest', 'flowschema', 'prioritylevelconfiguration'
        ];
        const defaults: ResourceType[] = ALL_TABS.filter(t => !skipResources.includes(t.id)).map(t => t.id)
        const saved = localStorage.getItem('k8s_desktop_visible_resources')
        if (!saved) return defaults
        try {
            const parsed = JSON.parse(saved)
            // Merge defaults to ensure new resources are available even if the user has old saved settings
            // But we don't force daemonsets here if it was meant to be hidden by default
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
            persistentvolume: ['name', 'capacity', 'access-modes', 'reclaim-policy', 'status', 'claim', 'storageclass', 'age'],
            persistentvolumeclaim: ['namespace', 'name', 'status', 'volume', 'capacity', 'access-modes', 'storageclass', 'volumemode', 'selected-node', 'vac', 'age'],
            ingress: ['namespace', 'name', 'class', 'hosts', 'address', 'ports', 'age'],
            ingressclass: ['name', 'controller', 'parameters', 'age'],
            networkpolicy: ['namespace', 'name', 'pod-selector', 'age'],
            endpointslices: ['namespace', 'name', 'address-type', 'ports', 'endpoints', 'age'],
            replicasets: ['namespace', 'name', 'desired', 'current', 'ready', 'age'],
            daemonsets: ['namespace', 'name', 'desired', 'current', 'ready', 'updated', 'available', 'node-selector', 'age'],
            jobs: ['namespace', 'name', 'status', 'completions', 'duration', 'age'],
            cronjobs: ['namespace', 'name', 'schedule', 'suspend', 'active', 'last-schedule', 'age'],
            secrets: ['namespace', 'name', 'type', 'data', 'age'],
            serviceaccounts: ['namespace', 'name', 'secrets', 'age'],
            storageclass: ['name', 'provisioner', 'reclaim-policy', 'binding-mode', 'allow-expansion', 'age'],
            volumesnapshot: ['namespace', 'name', 'ready-to-use', 'source', 'snapshot-class', 'size', 'age'],
            volumesnapshotclass: ['name', 'driver', 'deletion-policy', 'age'],
            role: ['namespace', 'name', 'age'],
            clusterrole: ['name', 'age'],
            rolebinding: ['namespace', 'name', 'binding-role', 'age'],
            clusterrolebinding: ['name', 'binding-role', 'age'],
            podsecurityadmission: ['name', 'enforce', 'audit', 'warn', 'age'],
            poddisruptionbudget: ['namespace', 'name', 'min-available', 'max-unavailable', 'allowed-disruptions', 'age'],
            limitrange: ['namespace', 'name', 'age'],
            resourcequota: ['namespace', 'name', 'age'],
            priorityclass: ['name', 'value', 'global-default', 'preemption-policy', 'age'],
            runtimeclass: ['name', 'handler', 'age'],
            lease: ['namespace', 'name', 'holder', 'duration', 'age'],
            customresourcedefinition: ['name', 'age'],
            mutatingwebhookconfiguration: ['name', 'webhooks', 'age'],
            validatingwebhookconfiguration: ['name', 'webhooks', 'age'],
            apiservice: ['name', 'service', 'available', 'age'],
            replicationcontroller: ['namespace', 'name', 'desired', 'current', 'ready', 'age'],
            endpoints: ['namespace', 'name', 'endpoints', 'age'],
            events: ['namespace', 'last-seen', 'type', 'reason', 'object', 'message'],
            bindings: ['namespace', 'name', 'age'],
            controllerrevisions: ['namespace', 'name', 'controller', 'revision', 'age'],
            certificatesigningrequest: ['name', 'requestor', 'condition', 'signer-name', 'age'],
            flowschema: ['name', 'priority-level', 'strategy', 'age'],
            prioritylevelconfiguration: ['name', 'type', 'age'],
            configmap: ['namespace', 'name', 'data', 'age'],
            nodes: ['name', 'status', 'roles', 'age', 'version']
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
        if (!saved) return {}
        try {
            return JSON.parse(saved)
        } catch {
            return {}
        }
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
                setError(resResult.error || `Failed to fetch ${activeTab} `)
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    const handleRestart = async (resName: string, ns: string, type: string) => {
        const promise = window.electron.rolloutRestart({
            contextName: name || '',
            resourceType: type,
            resourceName: resName,
            namespace: ns
        })

        toast.promise(promise, {
            loading: `Restarting ${type}/${resName}...`,
            success: 'Restart triggered successfully',
            error: (err) => `Failed to restart: ${err.error || err.message}`
        })

        try {
            await promise
            fetchData()
        } catch (err) {
            // Error is handled by toast.promise UI
            console.error('Restart failed:', err)
        }
    }

    const handleDelete = async (resName: string, ns: string, type: string) => {
        if (!window.confirm(`Are you sure you want to delete ${type}/${resName}?`)) return

        const promise = window.electron.deleteResource({
            contextName: name || '',
            resourceType: type,
            resourceName: resName,
            namespace: ns
        })

        toast.promise(promise, {
            loading: `Deleting ${type}/${resName}...`,
            success: 'Resource deleted successfully',
            error: (err) => `Failed to delete resource: ${err.error || err.message}`
        })

        try {
            const result = await promise
            if (result.success) {
                fetchData()
            }
        } catch (err) {
            // Error is handled by toast.promise UI
            console.error('Delete failed:', err)
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
                    valA = a.status?.containerStatuses?.reduce((acc: number, c: any) => acc + c.restartCount, 0) || 0
                    valB = b.status?.containerStatuses?.reduce((acc: number, c: any) => acc + c.restartCount, 0) || 0
                    break
                case 'ready':
                    valA = a.status?.readyReplicas || 0
                    valB = b.status?.readyReplicas || 0
                    break
                case 'updated':
                    valA = a.status?.updatedReplicas || 0
                    valB = b.status?.updatedReplicas || 0
                    break
                case 'available':
                    valA = a.status?.availableReplicas || 0
                    valB = b.status?.availableReplicas || 0
                    break
                case 'data':
                    valA = Object.keys(a.data || {}).length
                    valB = Object.keys(b.data || {}).length
                    break
                case 'roles':
                    valA = Object.keys(a.metadata?.labels || {}).filter(l => l.startsWith('node-role.kubernetes.io/')).join(', ')
                    valB = Object.keys(b.metadata?.labels || {}).filter(l => l.startsWith('node-role.kubernetes.io/')).join(', ')
                    break
                case 'version':
                    valA = a.status?.nodeInfo?.kubeletVersion || ''
                    valB = b.status?.nodeInfo?.kubeletVersion || ''
                    break
                case 'internal-ip':
                    valA = a.status?.addresses?.find((addr: any) => addr.type === 'InternalIP')?.address || ''
                    valB = b.status?.addresses?.find((addr: any) => addr.type === 'InternalIP')?.address || ''
                    break
                case 'external-ip':
                    valA = a.status?.addresses?.find((addr: any) => addr.type === 'ExternalIP')?.address || ''
                    valB = b.status?.addresses?.find((addr: any) => addr.type === 'ExternalIP')?.address || ''
                    break
                case 'os-image':
                    valA = a.status?.nodeInfo?.osImage || ''
                    valB = b.status?.nodeInfo?.osImage || ''
                    break
                case 'kernel-version':
                    valA = a.status?.nodeInfo?.kernelVersion || ''
                    valB = b.status?.nodeInfo?.kernelVersion || ''
                    break
                case 'container-runtime':
                    valA = a.status?.nodeInfo?.containerRuntimeVersion || ''
                    valB = b.status?.nodeInfo?.containerRuntimeVersion || ''
                    break
                case 'ip':
                    valA = a.status?.podIP || ''
                    valB = b.status?.podIP || ''
                    break
                case 'node':
                    valA = a.spec?.nodeName || ''
                    valB = b.spec?.nodeName || ''
                    break
                case 'containers':
                    valA = (a.spec?.template || a.spec)?.spec?.containers?.map((c: any) => c.name).join(', ') || ''
                    valB = (b.spec?.template || b.spec)?.spec?.containers?.map((c: any) => c.name).join(', ') || ''
                    break
                case 'images':
                    valA = (a.spec?.template || a.spec)?.spec?.containers?.map((c: any) => c.image).join(', ') || ''
                    valB = (b.spec?.template || b.spec)?.spec?.containers?.map((c: any) => c.image).join(', ') || ''
                    break
                case 'selector':
                    valA = JSON.stringify(a.spec?.selector?.matchLabels || a.spec?.selector || {})
                    valB = JSON.stringify(b.spec?.selector?.matchLabels || b.spec?.selector || {})
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

    const sortedItems = useMemo(getSortedItems, [items, sortConfig, activeTab])

    useEffect(() => {
        fetchData()
    }, [name, activeTab, selectedNamespace])

    const tabs = ALL_TABS.filter(tab => visibleResources.includes(tab.id))

    const toggleResource = (id: ResourceType) => {
        setVisibleResources(prev =>
            prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
        )
    }

    const toggleColumn = (resourceType: ResourceType, columnId: string) => {
        setVisibleColumns(prev => {
            const current = (prev && prev[resourceType]) || []
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
        <div className={`cluster-details-container ${resizing ? 'cluster-details-container-no-select' : ''}`}>
            <header className="cluster-details-header">
                <div className="header-top">
                    <button
                        onClick={() => navigate(-1)}
                        className="back-button"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="header-title-section">
                        <h2>{name}</h2>
                        <p>Cluster Detailed View</p>
                    </div>
                </div>

                <div className="header-controls">
                    <div className="tabs-container">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`tab-button ${activeTab === tab.id
                                    ? 'tab-button-active'
                                    : 'tab-button-inactive'
                                    }`}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="header-actions">
                        <div className="namespace-selector-container">
                            <Search className="namespace-selector-icon" size={16} />
                            <select
                                value={selectedNamespace}
                                onChange={(e) => setSelectedNamespace(e.target.value)}
                                className="namespace-selector"
                                aria-label="Namespace Selector"
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
                            className="refresh-data-button"
                            title="Refresh"
                        >
                            <RefreshCw size={18} className={loading ? 'refresh-icon-spinning' : ''} />
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                className={`settings-button ${isSettingsOpen ? 'settings-button-active' : 'settings-button-inactive'}`}
                                title="Visible Resources"
                            >
                                <Settings size={18} />
                            </button>

                            {isSettingsOpen && (
                                <div className="settings-dropdown">
                                    <div className="settings-dropdown-header">
                                        <span className="settings-dropdown-title">Display Settings</span>
                                        <button onClick={() => setIsSettingsOpen(false)} className="settings-close-button" title="Close Settings">
                                            <X size={14} />
                                        </button>
                                    </div>
                                    <div className="settings-dropdown-content">
                                        <div className="settings-section-title">Resources</div>
                                        <div className="settings-section">
                                            {ALL_TABS.map(tab => (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => toggleResource(tab.id)}
                                                    className="settings-item-button"
                                                >
                                                    <div className="settings-item-content">
                                                        <tab.icon size={14} className="settings-item-icon" />
                                                        <span className={visibleResources.includes(tab.id) ? 'settings-item-label-active' : 'settings-item-label-inactive'}>{tab.label}</span>
                                                    </div>
                                                    {visibleResources.includes(tab.id) && (
                                                        <Check size={14} className="settings-item-check" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="settings-section-title settings-divider">Columns for {activeTab}</div>
                                        <div className="settings-section">
                                            {COLUMN_DEFINITIONS[activeTab].map(col => (
                                                <button
                                                    key={col.id}
                                                    onClick={() => toggleColumn(activeTab, col.id)}
                                                    className="settings-item-button"
                                                >
                                                    <span className={visibleColumns[activeTab]?.includes(col.id) ? 'settings-item-label-active' : 'settings-item-label-inactive'}>{col.label}</span>
                                                    {visibleColumns[activeTab]?.includes(col.id) && (
                                                        <Check size={14} className="settings-item-check" />
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

            <main className="cluster-details-main">
                {loading && items.length === 0 ? (
                    <div className="loading-state">
                        <Loader2 className="loading-spinner" size={40} />
                        <p className="loading-text">Loading {activeTab}...</p>
                    </div>
                ) : error ? (
                    <div className="error-state">
                        <AlertCircle size={48} className="error-icon" />
                        <h3 className="error-title">Error Loading Resources</h3>
                        <p className="error-message">{error}</p>
                        <button
                            onClick={fetchData}
                            className="error-retry-button"
                        >
                            Try Again
                        </button>
                    </div>
                ) : items.length > 0 ? (
                    <ResourceTable
                        columns={COLUMN_DEFINITIONS[activeTab]}
                        visibleColumns={visibleColumns[activeTab] || []}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        getColumnWidth={getColumnWidth}
                        onResize={startResize}
                        resizingId={resizing?.id.replace(`${activeTab}-`, '') || null}
                    >
                        {sortedItems.map((item, idx) => (
                            <ResourceRow
                                key={`${item.metadata.uid || idx}`}
                                item={item}
                                activeTab={activeTab}
                                visibleColumns={visibleColumns[activeTab] || []}
                                getColumnWidth={getColumnWidth}
                                onDescribe={(item) => {
                                    setDescribeTarget({ name: item.metadata.name, ns: item.metadata.namespace, type: activeTab })
                                    setIsDescribeModalOpen(true)
                                }}
                                onYaml={(item) => {
                                    setYamlTarget({ name: item.metadata.name, ns: item.metadata.namespace, type: activeTab })
                                    setIsYamlModalOpen(true)
                                }}
                                onRestart={(item) => handleRestart(item.metadata.name, item.metadata.namespace, activeTab)}
                                onLogs={(item) => {
                                    setSelectedPod({ name: item.metadata.name, ns: item.metadata.namespace })
                                    setIsLogModalOpen(true)
                                }}
                                onDelete={(item) => handleDelete(item.metadata.name, item.metadata.namespace || '', activeTab)}
                            />
                        ))}
                    </ResourceTable>
                ) : (
                    <div className="empty-state">
                        <Box size={48} className="empty-icon" />
                        <p className="empty-title">No {activeTab} found</p>
                        <p className="empty-subtitle">In namespace: {selectedNamespace}</p>
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
