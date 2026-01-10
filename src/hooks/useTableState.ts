import { useState, useEffect } from 'react';

import type { SortConfig } from '../lib/sorting/types';

interface TableStateResult {
  sortConfig: SortConfig | null;
  handleSort: (key: string) => void;
  columnWidths: Record<string, number>;
  handleResize: (columnId: string, width: number) => void;
  getColumnWidth: (id: string, defWidth: number) => number;
  visibleColumns: string[];
  handleColumnToggle: (columnId: string) => void;
}

export function useTableState(
  defaultVisibleColumns: string[] = []
): TableStateResult {
  // Sorting State
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // Column Widths State (persisted in localStorage)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    () => {
      const saved = localStorage.getItem('columnWidths');
      if (!saved) return {};
      try {
        return JSON.parse(saved);
      } catch {
        console.error('Failed to parse columnWidths from localStorage');
        return {};
      }
    }
  );

  const handleResize = (columnId: string, width: number) => {
    setColumnWidths((prev) => {
      const next = { ...prev, [columnId]: width };
      localStorage.setItem('columnWidths', JSON.stringify(next));
      return next;
    });
  };

  const getColumnWidth = (id: string, defWidth: number) => {
    return columnWidths[id] || defWidth;
  };

  // Visible Columns State
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    defaultVisibleColumns
  );

  // Update visible columns when default changes (e.g. tab switch)
  useEffect(() => {
    // In a real app we might want to merge with user preferences here
    if (defaultVisibleColumns.length > 0) {
      setVisibleColumns(defaultVisibleColumns);
    }
  }, [defaultVisibleColumns]);

  const handleColumnToggle = (columnId: string) => {
    setVisibleColumns((prev) => {
      if (prev.includes(columnId)) {
        // Don't allow hiding the last column
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== columnId);
      }
      return [...prev, columnId];
    });
  };

  return {
    sortConfig,
    handleSort,
    columnWidths,
    handleResize,
    getColumnWidth,
    visibleColumns,
    handleColumnToggle,
  };
}
