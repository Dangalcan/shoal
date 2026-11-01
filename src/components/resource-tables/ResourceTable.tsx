import React, { useId } from 'react';

import { ChevronUp, ChevronDown } from 'lucide-react';
import { activateOnKey } from '../../lib/a11y';
import {
  MIN_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  clampColumnWidth,
} from '../../hooks/useTableState';

export interface ColumnDef {
  id: string;
  label: string;
  minWidth: number;
}

interface ResourceTableProps {
  columns: ColumnDef[];
  visibleColumns: string[];
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (key: string) => void;
  getColumnWidth: (id: string, defWidth: number) => number;
  /** Starts a mouse drag on a column's resize handle. */
  onResize: (e: React.MouseEvent, id: string, currentWidth: number) => void;
  /** Sets a column's width directly; the keyboard resizes through it. */
  onResizeTo: (id: string, width: number) => void;
  resizingId: string | null;
  children: React.ReactNode;
}

/** Pixels an arrow key moves a resize handle, and with Shift held. */
const RESIZE_STEP = 10;
const RESIZE_STEP_LARGE = 50;

/**
 * The width a column takes after a key on its resize handle: Left and
 * Right move it by a step (a larger one with Shift) and Home restores the
 * default. Null for any other key, which the handle leaves alone.
 */
function widthAfterKey(
  e: React.KeyboardEvent,
  width: number,
  defaultWidth: number
): number | null {
  const step = e.shiftKey ? RESIZE_STEP_LARGE : RESIZE_STEP;
  switch (e.key) {
    case 'ArrowLeft':
      return clampColumnWidth(width - step);
    case 'ArrowRight':
      return clampColumnWidth(width + step);
    case 'Home':
      return clampColumnWidth(defaultWidth);
    default:
      return null;
  }
}

export const ResourceTable: React.FC<ResourceTableProps> = ({
  columns,
  visibleColumns,
  sortConfig,
  onSort,
  getColumnWidth,
  onResize,
  onResizeTo,
  resizingId,
  children,
}) => {
  // The resize handle sits inside the header cell with its own aria-label,
  // which the cell's name-from-content would swallow ("Name Resize Name
  // column"); naming the cell by its label span keeps the name exactly the
  // column label, which the e2e specs and screen readers rely on.
  const labelIdBase = useId();
  const labelId = (id: string) => `${labelIdBase}-${id}`;

  const onHandleKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    col: ColumnDef,
    width: number
  ) => {
    const next = widthAfterKey(e, width, col.minWidth);
    if (next === null) return;
    // The handle sits inside the header cell, which sorts on Enter and
    // Space; a key the handle acts on never reaches it.
    e.preventDefault();
    e.stopPropagation();
    onResizeTo(col.id, next);
  };

  return (
    <div className="table-container">
      <div className="table-scroll">
        <table className="resource-table">
          <thead className="table-head">
            <tr>
              {columns.map((col) => {
                if (!visibleColumns.includes(col.id)) return null;
                const width = getColumnWidth(col.id, col.minWidth);
                const isSorted = sortConfig?.key === col.id;
                return (
                  <th
                    key={col.id}
                    className="table-head-cell"
                    style={{ width: `${width}px` }}
                    aria-labelledby={labelId(col.id)}
                    onClick={() => onSort(col.id)}
                    onKeyDown={(e) => activateOnKey(e, () => onSort(col.id))}
                    tabIndex={0}
                    aria-sort={
                      isSorted
                        ? sortConfig.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <div className="table-head-cell-content">
                      <span id={labelId(col.id)}>{col.label}</span>
                      {isSorted &&
                        (sortConfig.direction === 'asc' ? (
                          <ChevronUp size={14} className="sort-icon" />
                        ) : (
                          <ChevronDown size={14} className="sort-icon" />
                        ))}
                    </div>
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${col.label} column`}
                      aria-valuemin={MIN_COLUMN_WIDTH}
                      aria-valuemax={MAX_COLUMN_WIDTH}
                      aria-valuenow={width}
                      aria-valuetext={`${width} pixels`}
                      tabIndex={0}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onResize(e, col.id, width);
                      }}
                      onKeyDown={(e) => onHandleKeyDown(e, col, width)}
                      className={`resize-handle ${resizingId === col.id ? 'resize-handle-active' : ''}`}
                    >
                      <div
                        className={`resize-handle-indicator ${resizingId === col.id ? 'resize-handle-indicator-active' : ''}`}
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="table-body">{children}</tbody>
        </table>
      </div>
    </div>
  );
};
