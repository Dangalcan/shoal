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
    useResourceActions,
    useLocalStorage
} from '../hooks'
import { DetailsHeader } from '../components/cluster/DetailsHeader'
import { ResourceTabs } from '../components/cluster/ResourceTabs'
import { NamespaceSelector } from '../components/cluster/NamespaceSelector'
import { SettingsDropdown } from '../components/cluster/SettingsDropdown'
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
    const [visibleResources, setVisibleResources] = useLocalStorage<ResourceType[]>(
        'k8s_desktop_visible_resources',
        RESOURCE_CONFIGS.filter(c => !c.defaultHidden).map(c => c.id)
    )

    const {
        sortConfig,
        handleSort,
        handleResize,
        getColumnWidth,
        visibleColumns,
        handleColumnToggle
    } = useTableState(
      RESOURCE_CONFIGS.find(c => c.id === activeTab)?.defaultVisibleColumns || []
    )

    // Settings UI State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

    // Handle inactive visible tab
    useEffect(() => {
        if (!visibleResources.includes(activeTab)) {
            const nextTab = visibleResources.length > 0 ? visibleResources[0] : 'pods'
            setActiveTab(nextTab)
        }
    }, [visibleResources, activeTab])

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
                <DetailsHeader name={name || ''} />

                <div className="header-controls">
                    <ResourceTabs 
                        tabs={tabs} 
                        activeTab={activeTab} 
                        onTabChange={setActiveTab} 
                    />

                    <div className="header-actions">
                        <NamespaceSelector 
                            namespaces={namespaces} 
                            selectedNamespace={selectedNamespace} 
                            onNamespaceChange={setSelectedNamespace} 
                        />

                        <button onClick={fetchData} disabled={loading} className="refresh-data-button" title="Refresh">
                            <RefreshCw size={18} className={loading ? 'refresh-icon-spinning' : ''} />
                        </button>
                        
                        <SettingsDropdown 
                            isOpen={isSettingsOpen}
                            onToggle={() => setIsSettingsOpen(!isSettingsOpen)}
                            onClose={() => setIsSettingsOpen(false)}
                            visibleResources={visibleResources}
                            onToggleResource={toggleResource}
                            activeTab={activeTab}
                            visibleColumns={visibleColumns}
                            onToggleColumn={handleColumnToggle}
                        />
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
