import { useState, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

import type { SortConfig } from '../lib/sorting/types';

interface TableStateResult {
  sortConfig: SortConfig | null;
  handleSort: (key: string) => void;
  columnWidths: Record<string, number>;
  handleResize: (columnId: string, width: number) => void;
  getColumnWidth: (id: string, defWidth: number) => number;
  visibleColumns: string[];
  handleColumnToggle: (columnId: string) => void;
  resizingId: string | null;
  onResizeStart: (
    e: React.MouseEvent,
    id: string,
    currentWidth: number
  ) => void;
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
  const [columnWidths, setColumnWidths] = useLocalStorage<
    Record<string, number>
  >('columnWidths', {});

  const handleResize = (columnId: string, width: number) => {
    setColumnWidths((prev) => ({ ...prev, [columnId]: width }));
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

  // Resizing Active State
  const [resizing, setResizing] = useState<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const onResizeStart = (
    e: React.MouseEvent,
    id: string,
    currentWidth: number
  ) => {
    e.preventDefault();
    setResizing({ id, startX: e.clientX, startWidth: currentWidth });
  };

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      const newWidth = Math.max(50, resizing.startWidth + delta);
      handleResize(resizing.id, newWidth);
    };

    const handleMouseUp = () => setResizing(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  return {
    sortConfig,
    handleSort,
    columnWidths,
    handleResize,
    getColumnWidth,
    visibleColumns,
    handleColumnToggle,
    resizingId: resizing?.id || null,
    onResizeStart,
  };
}
