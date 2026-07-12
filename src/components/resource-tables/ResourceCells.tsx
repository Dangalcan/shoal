import React from 'react'
import { Terminal, Eye, FileCode, RefreshCw, Trash2, SquareTerminal, ArrowRightLeft } from 'lucide-react'


interface ActionProps {
    onDescribe?: () => void
    onYaml?: () => void
    onRestart?: () => void
    onLogs?: () => void
    onDelete?: () => void
    onExec?: () => void
    onForward?: () => void
    showRestart?: boolean
    showLogs?: boolean
    showExec?: boolean
    showForward?: boolean
}

export const NameCell: React.FC<{
    name: string
    namespace?: string
    onLogClick?: () => void
    actions: ActionProps
    /** Plugin-contributed action buttons rendered after the built-in ones. */
    extraActions?: React.ReactNode
} & React.HTMLAttributes<HTMLTableCellElement>> = ({ name, namespace, onLogClick, actions, extraActions, ...props }) => {
    return (
        <td className="table-cell table-cell-name" {...props} title={name}>
            <div className="table-cell-name-content">
                {onLogClick ? (
                    <button onClick={onLogClick} className="pod-name-button">
                        <span className="pod-name-text">{name}</span>
                        <Terminal size={14} className="pod-terminal-icon" />
                    </button>
                ) : (
                    <span className="pod-name-text">{name}</span>
                )}
                <div className="row-actions">
                    {actions.onDescribe && (
                        <button onClick={actions.onDescribe} className="action-button action-button-describe" title="Describe Resource">
                            <Eye size={14} />
                        </button>
                    )}
                    {actions.onYaml && (
                        <button onClick={actions.onYaml} className="action-button action-button-yaml" title="View YAML">
                            <FileCode size={14} />
                        </button>
                    )}
                    {actions.showRestart && actions.onRestart && (
                        <button onClick={actions.onRestart} className="action-button action-button-restart" title="Rollout Restart">
                            <RefreshCw size={14} />
                        </button>
                    )}
                    {actions.showLogs && actions.onLogs && (
                        <button onClick={actions.onLogs} className="action-button action-button-logs" title="View Logs">
                            <Terminal size={14} />
                        </button>
                    )}
                    {actions.showExec && actions.onExec && (
                        <button onClick={actions.onExec} className="action-button action-button-exec" title="Open Shell">
                            <SquareTerminal size={14} />
                        </button>
                    )}
                    {actions.showForward && actions.onForward && (
                        <button onClick={actions.onForward} className="action-button action-button-forward" title="Forward Port">
                            <ArrowRightLeft size={14} />
                        </button>
                    )}
                    {actions.onDelete && (
                        <button onClick={actions.onDelete} className="action-button action-button-delete" title="Delete Resource">
                            <Trash2 size={14} />
                        </button>
                    )}
                    {extraActions}
                </div>
            </div>
        </td>
    )
}

export const StatusBadge: React.FC<{
    status: string;
    type: 'pods' | 'pvc' | 'nodes' | 'other'
}> = ({ status, type }) => {
    let className = 'status-badge-other'

    if ((type === 'pods' && status === 'Running') ||
        (type === 'pvc' && status === 'Bound') ||
        (type === 'nodes' && status === 'Ready')) {
        className = 'status-badge-success'
    } else if (type === 'nodes') {
        className = 'status-badge-error'
    }

    return (
        <span className={`status-badge ${className}`}>
            {status}
        </span>
    )
}

export const TextCell: React.FC<{
    content: React.ReactNode
    variant?: 'default' | 'mono' | 'muted'
} & React.HTMLAttributes<HTMLTableCellElement>> = ({ content, variant = 'default', ...props }) => {
    const variantClass = variant === 'mono' ? 'table-cell-text-mono' : variant === 'muted' ? 'table-cell-text-muted' : 'table-cell-text'
    return (
        <td className={`table-cell ${variantClass}`} {...props}>
            {content}
        </td>
    )
}
