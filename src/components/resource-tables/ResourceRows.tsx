import React from 'react'
import { NameCell } from './ResourceCells'
import { ResourceType, COLUMN_DEFINITIONS } from '../../lib/resource-definitions'
import type { K8sResource } from '../../types/k8s-types'
import { renderCell } from './cell-renderers/renderCell'


interface ResourceRowProps {
    item: K8sResource
    activeTab: ResourceType
    visibleColumns: string[]
    getColumnWidth: (id: string, defWidth: number) => number
    onDescribe: (item: K8sResource) => void
    onYaml: (item: K8sResource) => void
    onRestart?: (item: K8sResource) => void
    onLogs?: (item: K8sResource) => void
    onDelete: (item: K8sResource) => void
}

export const ResourceRow: React.FC<ResourceRowProps> = ({
    item,
    activeTab,
    visibleColumns,
    getColumnWidth,
    onDescribe,
    onYaml,
    onRestart,
    onLogs,
    onDelete
}) => {
    const actions = {
        onDescribe: () => onDescribe(item),
        onYaml: () => onYaml(item),
        onRestart: onRestart ? () => onRestart(item) : undefined,
        onLogs: onLogs ? () => onLogs(item) : undefined,
        onDelete: () => onDelete(item),
        showRestart: activeTab === 'deployments' || activeTab === 'statefulsets' || activeTab === 'daemonsets',
        showLogs: activeTab === 'pods'
    }

    const columns = COLUMN_DEFINITIONS[activeTab] || []

    return (
        <tr className="table-row">
            {columns.map(col => {
                if (!visibleColumns.includes(col.id)) return null

                const width = getColumnWidth(col.id, col.minWidth)
                const style = { width: `${width}px` }

                // Special handling for 'name' column which has interactive elements
                if (col.id === 'name') {
                    return (
                        <NameCell
                            key={col.id}
                            name={item.metadata.name}
                            namespace={item.metadata.namespace}
                            onLogClick={activeTab === 'pods' ? actions.onLogs : undefined}
                            actions={actions}
                            style={style}
                        />
                    )
                }

                // Use the new cell renderer system for all other columns
                return renderCell({
                    colId: col.id,
                    resource: item,
                    resourceType: activeTab,
                    style
                })
            })}
        </tr>
    )
}
