import { useParams } from 'react-router-dom';
import { RefreshCw, Trash2 } from 'lucide-react';
import { DetailsHeader } from '../components/cluster/DetailsHeader';
import { ResourceTabs } from '../components/cluster/ResourceTabs';
import { NamespaceSelector } from '../components/cluster/NamespaceSelector';
import { SettingsDropdown } from '../components/cluster/SettingsDropdown';
import { ClusterResourceDisplay } from '../components/cluster/ClusterResourceDisplay';
import { ClusterDetailsModals } from '../components/cluster/ClusterDetailsModals';
import { useClusterDetails } from '../features/clusters/useClusterDetails';
import { DisplaySettingsContext } from '../features/clusters/DisplaySettingsContext';

export function ClusterDetails() {
  const { name } = useParams<{ name: string }>();
  const view = useClusterDetails(name);
  const { table, modals } = view;

  return (
    <DisplaySettingsContext.Provider value={view.displaySettings}>
      <div
        className={`cluster-details-container ${table.resizingId ? 'cluster-details-container-no-select' : ''}`}
      >
        <header className="cluster-details-header">
          <DetailsHeader name={name || ''} />

          <div className="header-controls">
            <ResourceTabs
              tabs={view.tabs}
              activeTab={view.activeTab}
              onTabChange={view.setActiveTab}
            />

            <div className="header-actions">
              <NamespaceSelector
                namespaces={view.namespaces}
                selectedNamespace={view.selectedNamespace}
                onNamespaceChange={view.setSelectedNamespace}
              />

              <button
                onClick={view.fetchData}
                disabled={view.loading}
                className="refresh-data-button"
                title="Refresh"
              >
                <RefreshCw
                  size={18}
                  className={view.loading ? 'refresh-icon-spinning' : ''}
                />
              </button>

              <button
                onClick={view.clusterDeletion.open}
                className="delete-cluster-button-action"
                title="Delete Cluster"
              >
                <Trash2 size={18} />
              </button>

              <SettingsDropdown />
            </div>
          </div>
        </header>

        <main className="cluster-details-main">
          <ClusterResourceDisplay
            loading={view.loading}
            error={view.error}
            items={view.items}
            sortedItems={view.sortedItems}
            activeTab={view.activeTab}
            visibleColumns={table.visibleColumns}
            sortConfig={table.sortConfig}
            onSort={table.handleSort}
            getColumnWidth={table.getColumnWidth}
            onResize={table.onResizeStart}
            resizingId={table.resizingId}
            onDescribe={modals.openDescribe}
            onYaml={modals.openYaml}
            onRestart={view.restartItem}
            onLogs={modals.openLogs}
            onExec={modals.openExec}
            onForward={modals.openForward}
            onScale={modals.openScale}
            onDelete={modals.openDelete}
            onRetry={view.fetchData}
            selectedNamespace={view.selectedNamespace}
          />
        </main>

        <ClusterDetailsModals
          name={name ?? ''}
          activeTab={view.activeTab}
          modals={modals}
          onDeleteItem={view.deleteItem}
          onScaleItem={view.scaleItem}
          clusterDeletion={view.clusterDeletion}
        />
      </div>
    </DisplaySettingsContext.Provider>
  );
}
