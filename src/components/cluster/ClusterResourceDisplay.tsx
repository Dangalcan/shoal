import React from 'react';
import { Loader2, AlertCircle, Box } from 'lucide-react';
import { ResourceTable } from '../resource-tables/ResourceTable';
import { ResourceRow } from '../resource-tables/ResourceRows';
import { COLUMN_DEFINITIONS, ResourceType } from '../../lib/resources/resource-definitions';
import { K8sResource } from '../../types/k8s-types';
import { SortConfig } from '../../lib/sorting/types';

interface ClusterResourceDisplayProps {
  loading: boolean;
  error: string | null;
  items: K8sResource[];
  sortedItems: K8sResource[];
  activeTab: ResourceType;
  visibleColumns: string[];
  sortConfig: SortConfig | null;
  onSort: (key: string) => void;
  getColumnWidth: (id: string, defWidth: number) => number;
  onResize: (e: React.MouseEvent, id: string, currentWidth: number) => void;
  resizingId: string | null;
  onDescribe: (item: K8sResource) => void;
  onYaml: (item: K8sResource) => void;
  onRestart: (item: K8sResource) => void;
  onLogs: (item: K8sResource) => void;
  onExec: (item: K8sResource) => void;
  onForward: (item: K8sResource) => void;
  onDelete: (item: K8sResource) => void;
  onRetry: () => void;
  selectedNamespace: string;
}

export const ClusterResourceDisplay: React.FC<ClusterResourceDisplayProps> = ({
  loading,
  error,
  items,
  sortedItems,
  activeTab,
  visibleColumns,
  sortConfig,
  onSort,
  getColumnWidth,
  onResize,
  resizingId,
  onDescribe,
  onYaml,
  onRestart,
  onLogs,
  onExec,
  onForward,
  onDelete,
  onRetry,
  selectedNamespace,
}) => {
  if (loading && items.length === 0) {
    return (
      <div className="loading-state">
        <Loader2 className="loading-spinner" size={40} />
        <p className="loading-text">Loading {activeTab}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <AlertCircle size={48} className="error-icon" />
        <h3 className="error-title">Error Loading Resources</h3>
        <p className="error-message">{error}</p>
        <button onClick={onRetry} className="error-retry-button">
          Try Again
        </button>
      </div>
    );
  }

  if (items.length > 0) {
    return (
      <ResourceTable
        columns={COLUMN_DEFINITIONS[activeTab]}
        visibleColumns={visibleColumns}
        sortConfig={sortConfig}
        onSort={onSort}
        getColumnWidth={getColumnWidth}
        onResize={onResize}
        resizingId={resizingId}
      >
        {sortedItems.map((item, idx) => (
          <ResourceRow
            key={`${item.metadata.uid || idx}`}
            item={item}
            activeTab={activeTab}
            visibleColumns={visibleColumns}
            getColumnWidth={getColumnWidth}
            onDescribe={onDescribe}
            onYaml={onYaml}
            onRestart={onRestart}
            onLogs={onLogs}
            onExec={onExec}
            onForward={onForward}
            onDelete={onDelete}
          />
        ))}
      </ResourceTable>
    );
  }

  return (
    <div className="empty-state">
      <Box size={48} className="empty-icon" />
      <p className="empty-title">No {activeTab} found</p>
      <p className="empty-subtitle">In namespace: {selectedNamespace}</p>
    </div>
  );
};
