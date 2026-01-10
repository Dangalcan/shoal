import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, RefreshCw, Loader2, AlertCircle, Settings, X, Check, Box } from 'lucide-react'
import { Toaster } from 'sonner'
import { LogViewerModal } from '../components/modals/LogViewerModal'
import { DescribeModal } from '../components/modals/DescribeModal'
import { YamlModal } from '../components/modals/YamlModal'
import { ResourceTable } from '../components/resource-tables/ResourceTable'
import { ResourceRow } from '../components/resource-tables/ResourceRows'
import { ResourceType, ALL_TABS, COLUMN_DEFINITIONS, RESOURCE_CONFIGS } from '../lib/resource-definitions'
import { getSorterForColumn } from '../lib/sorting'
import { 
    useClusterData, 
    useNamespaces, 
    useTableState, 
    useModalState, 
    useResourceActions 
} from '../hooks'
import '../../styles/pages/ClusterDetails.css'

export function ClusterDetails() {
    const { name } = useParams<{ name: string }>()
    const navigate = useNavigate()
    
    // 1. Navigation & Namespace State
    const [activeTab, setActiveTab] = useState<ResourceType>('pods')
    const { namespaces, selectedNamespace, setSelectedNamespace } = useNamespaces(name)

    // 2. Data Fetching
    const { items, loading, error, fetchData } = useClusterData(name, activeTab, selectedNamespace)

    // 3. Actions (Restart/Delete)
    const { handleRestart, handleDelete } = useResourceActions(name, fetchData)

    // 4. Modal State
    const modals = useModalState()

    // 5. Table State (Sorting, Resizing, Visibility)
    // Initialize visible resources logic
    const [visibleResources, setVisibleResources] = useState<ResourceType[]>(() => {
        const defaults = RESOURCE_CONFIGS
            .filter(c => !c.defaultHidden)
            .map(c => c.id)

        const saved = localStorage.getItem('k8s_desktop_visible_resources')
        if (!saved) return defaults
        try {
            const parsed = JSON.parse(saved)
            const missing = defaults.filter(d => !parsed.includes(d))
            // We could merge, or strictly respect saved. For now, we respect saved but ensure deletions/additions to defaults are handled if we were fully rigorous,
            // but sticking to saved preference + defaults for new resources is a safe bet,
            // or just purely saved if it exists.
            // The previous logic added missing defaults to saved, so let's keep that behavior.
            return [...parsed, ...missing] as ResourceType[]
        } catch { return defaults }
    })

    const {
        sortConfig,
        handleSort,
        handleResize,
        getColumnWidth,
        visibleColumns,
        handleColumnToggle
    } = useTableState(
      // Retrieve default visible columns from config for the active tab
      RESOURCE_CONFIGS.find(c => c.id === activeTab)?.defaultVisibleColumns || []
    )

    // Settings UI State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

    // 6. Derived State
    // Handle inactive visible tab
    useEffect(() => {
        if (!visibleResources.includes(activeTab)) {
            const nextTab = visibleResources.length > 0 ? visibleResources[0] : 'pods'
            setActiveTab(nextTab)
        }
    }, [visibleResources, activeTab, visibleResources.includes])

    // Persist visible resources
    useEffect(() => {
        localStorage.setItem('k8s_desktop_visible_resources', JSON.stringify(visibleResources))
    }, [visibleResources])

    // Sorting Logic
    const sortedItems = useMemo(() => {
        if (!sortConfig) return items
        const sorter = getSorterForColumn(sortConfig.key, activeTab)
        const sorted = [...items].sort(sorter)
        return sortConfig.direction === 'asc' ? sorted : sorted.reverse()
    }, [items, sortConfig, activeTab])

    const tabs = ALL_TABS.filter(tab => visibleResources.includes(tab.id))

    const toggleResource = (id: ResourceType) => {
        setVisibleResources(prev =>
            prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
        )
    }

    // Handlers for Resize
    const [resizing, setResizing] = useState<{ id: string; startX: number; startWidth: number } | null>(null)
    const onResizeStart = (e: React.MouseEvent, id: string, currentWidth: number) => {
        e.preventDefault()
        setResizing({ id, startX: e.clientX, startWidth: currentWidth })
    }

    // Handle global mouse events for resizing
    useEffect(() => {
        if (!resizing) return
        const handleMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - resizing.startX
            const newWidth = Math.max(50, resizing.startWidth + delta)
            handleResize(resizing.id, newWidth)
        }
        const handleMouseUp = () => setResizing(null)
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [resizing, handleResize])

    return (
        <div className={`cluster-details-container ${resizing ? 'cluster-details-container-no-select' : ''}`}>
            <header className="cluster-details-header">
                <div className="header-top">
                    <button onClick={() => navigate(-1)} className="back-button">
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
                                className={`tab-button ${activeTab === tab.id ? 'tab-button-active' : 'tab-button-inactive'}`}
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
                    id="namespace-selector"
                    aria-label="Namespace Selector"
                    value={selectedNamespace}
                    onChange={(e) => setSelectedNamespace(e.target.value)}
                    className="namespace-selector"
                >
                    {Array.from(new Set(['all', ...namespaces])).map(ns => (
                        <option key={ns} value={ns}>{ns === 'all' ? 'All Namespaces' : ns}</option>
                    ))}
                </select>
                        </div>
                        <button onClick={fetchData} disabled={loading} className="refresh-data-button" title="Refresh">
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
                                                <button key={tab.id} onClick={() => toggleResource(tab.id)} className="settings-item-button">
                                                    <div className="settings-item-content">
                                                        <tab.icon size={14} className="settings-item-icon" />
                                                        <span className={visibleResources.includes(tab.id) ? 'settings-item-label-active' : 'settings-item-label-inactive'}>{tab.label}</span>
                                                    </div>
                                                    {visibleResources.includes(tab.id) && <Check size={14} className="settings-item-check" />}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="settings-section-title settings-divider">Columns for {activeTab}</div>
                                        <div className="settings-section">
                                            {COLUMN_DEFINITIONS[activeTab].map(col => (
                                                <button key={col.id} onClick={() => handleColumnToggle(col.id)} className="settings-item-button">
                                                    <span className={visibleColumns.includes(col.id) ? 'settings-item-label-active' : 'settings-item-label-inactive'}>{col.label}</span>
                                                    {visibleColumns.includes(col.id) && <Check size={14} className="settings-item-check" />}
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
                        <button onClick={fetchData} className="error-retry-button">Try Again</button>
                    </div>
                ) : items.length > 0 ? (
                    <ResourceTable
                        columns={COLUMN_DEFINITIONS[activeTab]}
                        visibleColumns={visibleColumns}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        getColumnWidth={getColumnWidth}
                        onResize={onResizeStart}
                        resizingId={resizing?.id || null}
                    >
                        {sortedItems.map((item, idx) => (
                            <ResourceRow
                                key={`${item.metadata.uid || idx}`}
                                item={item}
                                activeTab={activeTab}
                                visibleColumns={visibleColumns}
                                getColumnWidth={getColumnWidth}
                                onDescribe={modals.openDescribe}
                                onYaml={modals.openYaml}
                                onRestart={(item) => handleRestart(item.metadata.name, item.metadata.namespace || '', activeTab)}
                                onLogs={modals.openLogs}
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
                isOpen={modals.showLogs}
                onClose={modals.closeAll}
                clusterName={name || ''}
                podName={modals.selectedItem?.metadata.name || ''}
                namespace={modals.selectedItem?.metadata.namespace || ''}
            />
            <DescribeModal
                isOpen={modals.showDescribe}
                onClose={modals.closeAll}
                clusterName={name || ''}
                resourceName={modals.selectedItem?.metadata.name || ''}
                resourceType={activeTab}
                namespace={modals.selectedItem?.metadata.namespace || ''}
            />
            <YamlModal
                isOpen={modals.showYaml}
                onClose={modals.closeAll}
                clusterName={name || ''}
                resourceName={modals.selectedItem?.metadata.name || ''}
                resourceType={activeTab}
                namespace={modals.selectedItem?.metadata.namespace || ''}
            />
            <Toaster position="bottom-right" richColors />
        </div>
    )
}
