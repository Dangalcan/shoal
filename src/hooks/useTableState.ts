import { useState, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

import type { SortConfig } from '../lib/sorting/types';

/** A column is never narrower than this, by mouse or keyboard... */
export const MIN_COLUMN_WIDTH = 50;
/** ...nor wider. Both bound the resize handles' `aria-value*` too. */
export const MAX_COLUMN_WIDTH = 1000;

export function clampColumnWidth(width: number): number {
  return Math.min(
    MAX_COLUMN_WIDTH,
    Math.max(MIN_COLUMN_WIDTH, Math.round(width))
  );
}

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

  // Every resize, dragged or keyed, lands here, so the bounds apply once.
  const handleResize = (columnId: string, width: number) => {
    const clamped = clampColumnWidth(width);
    setColumnWidths((prev) => ({ ...prev, [columnId]: clamped }));
  };

  const getColumnWidth = (id: string, defWidth: number) => {
    return columnWidths[id] || defWidth;
  };

  // Visible Columns State: the user's toggles, null while the defaults
  // apply. The defaults belong to the active tab (one constant list per
  // resource kind), so a tab switch shows that tab's defaults again and the
  // toggles are dropped, during render (React's "adjust state when a prop
  // changes" pattern). A tab without defaults keeps whatever was visible.
  const base = defaultVisibleColumns.length > 0 ? defaultVisibleColumns : null;
  const [columns, setColumns] = useState<string[] | null>(null);
  const [seenBase, setSeenBase] = useState(base);
  if (base !== null && seenBase !== base) {
    setSeenBase(base);
    setColumns(null);
  }
  const visibleColumns = columns ?? defaultVisibleColumns;

  const handleColumnToggle = (columnId: string) => {
    setColumns((prev) => {
      const current = prev ?? defaultVisibleColumns;
      if (current.includes(columnId)) {
        // Don't allow hiding the last column
        if (current.length <= 1) return prev;
        return current.filter((id) => id !== columnId);
      }
      return [...current, columnId];
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
      handleResize(resizing.id, resizing.startWidth + delta);
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
