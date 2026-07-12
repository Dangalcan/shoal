import React from 'react'
import { NameCell } from './ResourceCells'
import { ResourceType, COLUMN_DEFINITIONS } from '../../lib/resources/resource-definitions'
import type { K8sResource } from '../../types/k8s-types'
import { renderCell } from './cell-renderers/renderCell'
import { PluginResourceActions } from '../../features/plugins/PluginResourceActions'


interface ResourceRowProps {
    item: K8sResource
    activeTab: ResourceType
    visibleColumns: string[]
    getColumnWidth: (id: string, defWidth: number) => number
    onDescribe: (item: K8sResource) => void
    onYaml: (item: K8sResource) => void
    onRestart?: (item: K8sResource) => void
    onLogs?: (item: K8sResource) => void
    onExec?: (item: K8sResource) => void
    onForward?: (item: K8sResource) => void
    onScale?: (item: K8sResource) => void
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
    onExec,
    onForward,
    onScale,
    onDelete
}) => {
    const actions = {
        onDescribe: () => onDescribe(item),
        onYaml: () => onYaml(item),
        onRestart: onRestart ? () => onRestart(item) : undefined,
        onLogs: onLogs ? () => onLogs(item) : undefined,
        onExec: onExec ? () => onExec(item) : undefined,
        onForward: onForward ? () => onForward(item) : undefined,
        onScale: onScale ? () => onScale(item) : undefined,
        onDelete: () => onDelete(item),
        showRestart: activeTab === 'deployments' || activeTab === 'statefulsets' || activeTab === 'daemonsets',
        showScale: activeTab === 'deployments' || activeTab === 'statefulsets',
        showLogs: activeTab === 'pods',
        showExec: activeTab === 'pods',
        showForward: activeTab === 'pods' || activeTab === 'services',
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
                            extraActions={
                                <PluginResourceActions
                                    resource={item}
                                    resourceType={activeTab}
                                />
                            }
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
