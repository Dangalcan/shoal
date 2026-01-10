import React from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import '../../../styles/components/resource-tables/ResourceTable.css'

export interface ColumnDef {
    id: string
    label: string
    minWidth: number
}

interface ResourceTableProps {
    columns: ColumnDef[]
    visibleColumns: string[]
    sortConfig: { key: string; direction: 'asc' | 'desc' } | null
    onSort: (key: string) => void
    getColumnWidth: (id: string, defWidth: number) => number
    onResize: (e: React.MouseEvent, id: string, currentWidth: number) => void
    resizingId: string | null
    children: React.ReactNode
}

export const ResourceTable: React.FC<ResourceTableProps> = ({
    columns,
    visibleColumns,
    sortConfig,
    onSort,
    getColumnWidth,
    onResize,
    resizingId,
    children
}) => {
    return (
        <div className="table-container">
            <div className="table-scroll">
                <table className="resource-table">
                    <thead className="table-head">
                        <tr>
                            {columns.map(col => {
                                if (!visibleColumns.includes(col.id)) return null
                                const width = getColumnWidth(col.id, col.minWidth)
                                const isSorted = sortConfig?.key === col.id
                                return (
                                    <th
                                        key={col.id}
                                        className="table-head-cell"
                                        style={{ width: `${width}px` }}
                                        onClick={() => onSort(col.id)}
                                    >
                                        <div className="table-head-cell-content">
                                            <span>{col.label}</span>
                                            {isSorted && (
                                                sortConfig.direction === 'asc' ? <ChevronUp size={14} className="sort-icon" /> : <ChevronDown size={14} className="sort-icon" />
                                            )}
                                        </div>
                                        <div
                                            onMouseDown={(e) => {
                                                e.stopPropagation()
                                                onResize(e, col.id, width)
                                            }}
                                            className={`resize-handle ${resizingId === col.id ? 'resize-handle-active' : ''}`}
                                        >
                                            <div className={`resize-handle-indicator ${resizingId === col.id ? 'resize-handle-indicator-active' : ''}`} />
                                        </div>
                                    </th>
                                )
                            })}
                        </tr>
                    </thead>
                    <tbody className="table-body">
                        {children}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
