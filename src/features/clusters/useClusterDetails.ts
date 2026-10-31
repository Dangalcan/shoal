import { useState, useMemo, useCallback } from 'react';
import { RESOURCE_CONFIGS } from '../../lib/resources/resource-definitions';
import { getSorterForColumn } from '../../lib/sorting';
import {
  useClusterData,
  useNamespaces,
  useTableState,
  useModalState,
  useResourceActions,
} from '../../hooks';
import { useClusterTabs } from './useClusterTabs';
import { useClusterDeletion } from './useClusterDeletion';
import type { DisplaySettingsContextType } from './DisplaySettingsContext';
import type { K8sResource } from '../../types/k8s-types';

/**
 * Everything the cluster details page shows and does for one context: the
 * active tab and namespace, the resource rows (sorted), the table state, the
 * row modals and actions, the display settings and the cluster deletion.
 */
export function useClusterDetails(name: string | undefined) {
  const { activeTab, setActiveTab, tabs, visibleResources, toggleResource } =
    useClusterTabs(name);
  const { namespaces, selectedNamespace, setSelectedNamespace } =
    useNamespaces(name);

  // Data, row actions, modals and table state
  const { items, loading, error, fetchData } = useClusterData(
    name,
    activeTab,
    selectedNamespace
  );
  const { handleRestart, handleDelete, handleScale } = useResourceActions(
    name,
    fetchData
  );
  const modals = useModalState();
  const activeConfig = RESOURCE_CONFIGS.find((c) => c.id === activeTab);
  const table = useTableState(activeConfig?.defaultVisibleColumns || []);

  // Display settings (the dropdown)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const toggleSettings = useCallback(() => setIsSettingsOpen((v) => !v), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const displaySettings = useMemo<DisplaySettingsContextType>(
    () => ({
      isSettingsOpen,
      toggleSettings,
      closeSettings,
      visibleResources,
      toggleResource,
      activeTab,
      visibleColumns: table.visibleColumns,
      toggleColumn: table.handleColumnToggle,
    }),
    [
      isSettingsOpen,
      toggleSettings,
      closeSettings,
      visibleResources,
      toggleResource,
      activeTab,
      table.visibleColumns,
      table.handleColumnToggle,
    ]
  );

  const sortedItems = useMemo(() => {
    if (!table.sortConfig) return items;
    const sorter = getSorterForColumn(table.sortConfig.key, activeTab);
    const sorted = [...items].sort(sorter);
    return table.sortConfig.direction === 'asc' ? sorted : sorted.reverse();
  }, [items, table.sortConfig, activeTab]);

  // Row actions take the row; the resource kind is the active tab's.
  const restartItem = (item: K8sResource) =>
    handleRestart(item.metadata.name, item.metadata.namespace || '', activeTab);
  const deleteItem = (item: K8sResource) =>
    handleDelete(item.metadata.name, item.metadata.namespace || '', activeTab);
  const scaleItem = (item: K8sResource, replicas: number) =>
    handleScale(
      item.metadata.name,
      item.metadata.namespace || '',
      activeTab,
      replicas
    );

  const clusterDeletion = useClusterDeletion(name);

  return {
    activeTab,
    setActiveTab,
    tabs,
    namespaces,
    selectedNamespace,
    setSelectedNamespace,
    items,
    sortedItems,
    loading,
    error,
    fetchData,
    table,
    modals,
    displaySettings,
    restartItem,
    deleteItem,
    scaleItem,
    clusterDeletion,
  };
}
