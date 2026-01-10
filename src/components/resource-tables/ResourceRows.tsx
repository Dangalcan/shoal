import React from 'react'
import { NameCell, StatusBadge, TextCell } from './ResourceCells'
import { ResourceType, COLUMN_DEFINITIONS } from '../../lib/resource-definitions'
import '../../../styles/components/resource-tables/ResourceRows.css'

interface ResourceRowProps {
    item: any
    activeTab: ResourceType
    visibleColumns: string[]
    getColumnWidth: (id: string, defWidth: number) => number
    onDescribe: (item: any) => void
    onYaml: (item: any) => void
    onRestart?: (item: any) => void
    onLogs?: (item: any) => void
    onDelete: (item: any) => void
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

    const renderCell = (colId: string, minWidth: number) => {
        if (!visibleColumns.includes(colId)) return null
        const width = getColumnWidth(colId, minWidth)
        const style = { width: `${width}px` }

        switch (colId) {
            case 'namespace':
                return <td key={colId} className="table-cell table-cell-namespace" style={style}>{item.metadata.namespace}</td>
            case 'name':
                return (
                    <NameCell
                        key={colId}
                        name={item.metadata.name}
                        namespace={item.metadata.namespace}
                        onLogClick={activeTab === 'pods' ? actions.onLogs : undefined}
                        actions={actions}
                        style={style}
                    />
                )
            case 'status':
                let statusVal = ''
                let type: 'pods' | 'pvc' | 'nodes' | 'other' = 'other'
                if (activeTab === 'pods') {
                    statusVal = item.status?.phase || 'Unknown'
                    type = 'pods'
                } else if (activeTab === 'persistentvolumeclaim') {
                    statusVal = item.status?.phase || 'Unknown'
                    type = 'pvc'
                } else if (activeTab === 'nodes') {
                    const ready = item.status?.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True'
                    statusVal = ready ? 'Ready' : 'NotReady'
                    type = 'nodes'
                } else if (activeTab === 'jobs') {
                    if (item.status?.succeeded >= 1) statusVal = 'Complete'
                    else if (item.status?.failed >= 1) statusVal = 'Failed'
                    else statusVal = 'Running'
                }
                return (
                    <td key={colId} className="table-cell" style={style}>
                        <StatusBadge status={statusVal} type={type} />
                    </td>
                )
            case 'restarts':
                const restarts = item.status?.containerStatuses?.reduce((acc: number, c: any) => acc + c.restartCount, 0) || 0
                return <TextCell key={colId} content={String(restarts)} style={style} />
            case 'ready':
                let readyContent: string | number = 0
                if (activeTab === 'replicasets') {
                    readyContent = item.status?.readyReplicas || 0
                } else if (activeTab === 'daemonsets') {
                    readyContent = item.status?.numberReady || 0
                } else {
                    readyContent = `${item.status?.readyReplicas || 0} / ${item.status?.replicas || 0}`
                }
                return <TextCell key={colId} content={String(readyContent)} style={style} />
            case 'completions':
                return <TextCell key={colId} content={`${item.status?.succeeded || 0} / ${item.spec?.completions || 1}`} style={style} />
            case 'duration':
                let duration = '-'
                if (item.status?.startTime) {
                    const start = new Date(item.status.startTime).getTime()
                    const end = item.status.completionTime ? new Date(item.status.completionTime).getTime() : Date.now()
                    const seconds = Math.floor((end - start) / 1000)
                    if (seconds < 60) duration = `${seconds}s`
                    else if (seconds < 3600) duration = `${Math.floor(seconds / 60)}m${seconds % 60}s`
                    else duration = `${Math.floor(seconds / 3600)}h${Math.floor((seconds % 3600) / 60)}m`
                }
                return <TextCell key={colId} content={duration} style={style} />
            case 'updated':
                const updatedVal = activeTab === 'daemonsets' ? item.status?.updatedNumberScheduled : item.status?.updatedReplicas
                return <TextCell key={colId} content={String(updatedVal || 0)} style={style} />
            case 'available':
                const availableVal = activeTab === 'daemonsets' ? item.status?.numberAvailable : item.status?.availableReplicas
                return <TextCell key={colId} content={String(availableVal || 0)} style={style} />
            case 'age':
                return <TextCell key={colId} variant="muted" content={new Date(item.metadata.creationTimestamp).toLocaleString()} style={style} />
            case 'type':
                return <TextCell key={colId} content={item.spec?.type || item.type || '-'} style={style} />
            case 'cluster-ip':
                return <TextCell key={colId} variant="mono" content={item.spec?.clusterIP || '-'} style={style} />
            case 'external-ip':
                let extIp = '<none>'
                if (activeTab === 'services') {
                    extIp = item.status?.loadBalancer?.ingress?.[0]?.ip || item.status?.loadBalancer?.ingress?.[0]?.hostname || '<none>'
                } else if (activeTab === 'nodes') {
                    extIp = item.status?.addresses?.find((addr: any) => addr.type === 'ExternalIP')?.address || '<none>'
                }
                return <TextCell key={colId} variant="mono" content={extIp} style={style} />
            case 'ports':
                let ports = '<none>'
                if (activeTab === 'services') {
                    ports = item.spec?.ports?.map((p: any) => `${p.port}/${p.protocol}`).join(', ') || '<none>'
                } else if (activeTab === 'ingress') {
                    ports = item.spec?.tls ? '80, 443' : '80'
                } else if (activeTab === 'endpointslices') {
                    ports = item.ports?.map((p: any) => `${p.port}/${p.protocol}`).join(', ') || '<none>'
                }
                return <TextCell key={colId} content={ports} style={style} />
            case 'schedule':
                return <TextCell key={colId} variant="mono" content={item.spec?.schedule || '-'} style={style} />
            case 'suspend':
                return <TextCell key={colId} content={String(item.spec?.suspend ?? false)} style={style} />
            case 'active':
                return <TextCell key={colId} content={String(item.status?.active?.length || 0)} style={style} />
            case 'last-schedule':
                let lastSchedule = '<none>'
                if (item.status?.lastScheduleTime) {
                    lastSchedule = new Date(item.status.lastScheduleTime).toLocaleString()
                }
                return <TextCell key={colId} content={lastSchedule} style={style} />
            case 'ip':
                return <TextCell key={colId} variant="mono" content={item.status?.podIP || '<none>'} style={style} />
            case 'node':
                return <TextCell key={colId} content={item.spec?.nodeName || '<none>'} style={style} />
            case 'nominated-node':
                return <TextCell key={colId} content={item.status?.nominatedNodeName || '<none>'} style={style} />
            case 'readiness-gates':
                return <TextCell key={colId} content={item.spec?.readinessGates?.map((g: any) => g.conditionType).join(', ') || '<none>'} style={style} />
            case 'containers':
                return <TextCell key={colId} content={(item.spec?.template?.spec || item.spec)?.containers?.map((c: any) => c.name).join(', ') || '<none>'} style={style} />
            case 'images':
                return <TextCell key={colId} content={(item.spec?.template?.spec || item.spec)?.containers?.map((c: any) => c.image).join(', ') || '<none>'} style={style} />
            case 'selector':
                const labels = item.spec?.selector?.matchLabels || item.spec?.selector || {}
                const selectorContent = Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(',') || '<none>'
                return <TextCell key={colId} content={selectorContent} style={style} />
            case 'controller':
                return <TextCell key={colId} content={item.spec?.controller || '<none>'} style={style} />
            case 'parameters':
                const params = item.spec?.parameters
                const paramsContent = params ? `${params.kind}:${params.name}` : '<none>'
                return <TextCell key={colId} content={paramsContent} style={style} />
            case 'pod-selector':
                const podLabels = item.spec?.podSelector?.matchLabels || {}
                const psContent = Object.entries(podLabels).map(([k, v]) => `${k}=${v}`).join(',') || '<none>'
                return <TextCell key={colId} content={psContent} style={style} />
            case 'policy-types':
                return <TextCell key={colId} content={item.spec?.policyTypes?.join(', ') || '<none>'} style={style} />
            case 'provisioner':
                return <TextCell key={colId} content={item.provisioner || '<none>'} style={style} />
            case 'binding-mode':
                return <TextCell key={colId} content={item.volumeBindingMode || '<none>'} style={style} />
            case 'allow-expansion':
                return <TextCell key={colId} content={String(item.allowVolumeExpansion ?? false)} style={style} />
            case 'ready-to-use':
                return <TextCell key={colId} content={String(item.status?.readyToUse ?? false)} style={style} />
            case 'source':
                const source = item.spec?.source?.persistentVolumeClaimName || item.spec?.source?.volumeSnapshotContentName || '<none>'
                return <TextCell key={colId} variant="mono" content={source} style={style} />
            case 'snapshot-class':
                return <TextCell key={colId} content={item.spec?.volumeSnapshotClassName || '<none>'} style={style} />
            case 'size':
                return <TextCell key={colId} content={item.status?.restoreSize || '<none>'} style={style} />
            case 'driver':
                return <TextCell key={colId} content={item.driver || '<none>'} style={style} />
            case 'deletion-policy':
                return <TextCell key={colId} content={item.deletionPolicy || '<none>'} style={style} />
            case 'binding-role':
                const roleRef = item.roleRef || {}
                return <TextCell key={colId} content={`${roleRef.kind || ''}/${roleRef.name || ''}`} style={style} />
            case 'enforce':
            case 'audit':
            case 'warn':
                const psaValue = item.metadata?.labels?.[`pod-security.kubernetes.io/${colId}`] || '<none>'
                return <TextCell key={colId} content={psaValue} style={style} />
            case 'min-available':
                return <TextCell key={colId} content={item.spec?.minAvailable || 'N/A'} style={style} />
            case 'max-unavailable':
                return <TextCell key={colId} content={item.spec?.maxUnavailable || 'N/A'} style={style} />
            case 'allowed-disruptions':
                return <TextCell key={colId} content={item.status?.disruptionsAllowed?.toString() || '0'} style={style} />
            case 'value':
                return <TextCell key={colId} content={item.value?.toString() || '0'} style={style} />
            case 'global-default':
                return <TextCell key={colId} content={item.globalDefault ? 'true' : 'false'} style={style} />
            case 'preemption-policy':
                return <TextCell key={colId} content={item.preemptionPolicy || '<none>'} style={style} />
            case 'handler':
                return <TextCell key={colId} content={item.handler || '<none>'} style={style} />
            case 'holder':
                return <TextCell key={colId} variant="mono" content={item.spec?.holderIdentity || '<none>'} style={style} />
            case 'duration':
                return <TextCell key={colId} content={`${item.spec?.leaseDurationSeconds || 0}s`} style={style} />
            case 'webhooks':
                const webhookCount = (item.webhooks?.length || 0).toString()
                return <TextCell key={colId} content={webhookCount} style={style} />
            case 'service':
                const svc = item.spec?.service
                return <TextCell key={colId} variant="mono" content={svc ? `${svc.namespace}/${svc.name}` : '<none>'} style={style} />
            case 'available':
                const cond = item.status?.conditions?.find((c: any) => c.type === 'Available')
                return <TextCell key={colId} content={cond?.status || 'Unknown'} style={style} />
            case 'endpoints':
                const subsets = item.subsets || []
                const epStrings = subsets.map((s: any) => {
                    const addresses = (s.addresses || []).map((a: any) => a.ip).join(',')
                    const ports = (s.ports || []).map((p: any) => p.port).join(',')
                    return addresses && ports ? `${addresses}:${ports}` : addresses || ports || ''
                }).filter(Boolean).join(', ')
                return <TextCell key={colId} content={epStrings || '<none>'} style={style} />
            case 'last-seen':
                return <TextCell key={colId} content={item.lastTimestamp || item.eventTime || '<unknown>'} style={style} />
            case 'reason':
                return <TextCell key={colId} content={item.reason || '<none>'} style={style} />
            case 'object':
                const obj = item.involvedObject || {}
                return <TextCell key={colId} variant="mono" content={`${obj.kind || ''}/${obj.name || ''}`} style={style} />
            case 'message':
                return <TextCell key={colId} content={item.message || '<none>'} style={style} />
            case 'controller':
                const owner = item.metadata?.ownerReferences?.[0]
                return <TextCell key={colId} variant="mono" content={owner ? `${owner.kind}/${owner.name}` : '<none>'} style={style} />
            case 'revision':
                return <TextCell key={colId} content={item.revision?.toString() || '0'} style={style} />
            case 'requestor':
                return <TextCell key={colId} variant="mono" content={item.spec?.username || '<none>'} style={style} />
            case 'condition':
                const csrCond = item.status?.conditions?.[0]
                return <TextCell key={colId} content={csrCond?.type || 'Pending'} style={style} />
            case 'signer-name':
                return <TextCell key={colId} content={item.spec?.signerName || '<none>'} style={style} />
            case 'priority-level':
                return <TextCell key={colId} variant="mono" content={item.spec?.priorityLevelConfiguration?.name || '<none>'} style={style} />
            case 'strategy':
                return <TextCell key={colId} content={item.spec?.distinguisherMethod?.type || 'None'} style={style} />
            case 'address-type':
                return <TextCell key={colId} content={item.addressType || '<none>'} style={style} />
            case 'endpoints':
                const addresses = item.endpoints?.flatMap((ep: any) => ep.addresses || []) || []
                const epContent = addresses.length > 3 
                    ? `${addresses.slice(0, 3).join(', ')} + ${addresses.length - 3} more`
                    : addresses.join(', ') || '<none>'
                return <TextCell key={colId} variant="mono" content={epContent} style={style} />
            case 'service-name':
                return <TextCell key={colId} content={item.metadata.labels?.['kubernetes.io/service-name'] || '<none>'} style={style} />
            case 'secrets':
                if (activeTab === 'serviceaccounts') {
                    return <TextCell key={colId} content={String(item.secrets?.length || 0)} style={style} />
                }
                const secretData = item.data ? Object.keys(item.data).length : 0
                return <TextCell key={colId} content={String(secretData)} style={style} />
            case 'node-selector':
                const nodeSelector = item.spec?.template?.spec?.nodeSelector || {}
                const nsContent = Object.entries(nodeSelector).map(([k, v]) => `${k}=${v}`).join(',') || '<none>'
                return <TextCell key={colId} content={nsContent} style={style} />
            case 'reference':
                return <TextCell key={colId} content={`${item.spec?.scaleTargetRef?.kind}/${item.spec?.scaleTargetRef?.name}`} style={style} />
            case 'targets':
                const currentVal = item.status?.currentMetrics?.[0]?.resource?.current?.averageUtilization ?? item.status?.currentCPUUtilizationPercentage ?? '0'
                const targetVal = item.spec?.metrics?.[0]?.resource?.target?.averageUtilization ?? item.spec?.targetCPUUtilizationPercentage ?? '0'
                return <TextCell key={colId} content={`${currentVal}% / ${targetVal}%`} style={style} />
            case 'minpods':
                return <TextCell key={colId} content={String(item.spec?.minReplicas || 0)} style={style} />
            case 'maxpods':
                return <TextCell key={colId} content={String(item.spec?.maxReplicas || 0)} style={style} />
            case 'desired':
                const desiredVal = activeTab === 'daemonsets' ? item.status?.desiredNumberScheduled : item.spec?.replicas
                return <TextCell key={colId} content={String(desiredVal || 0)} style={style} />
            case 'current':
                const currentReplicaVal = activeTab === 'daemonsets' ? item.status?.currentNumberScheduled : item.status?.replicas
                return <TextCell key={colId} content={String(currentReplicaVal || 0)} style={style} />
            case 'replicas':
                return <TextCell key={colId} content={String(item.status?.currentReplicas || 0)} style={style} />
            case 'volume':
                return <TextCell key={colId} variant="mono" content={item.spec?.volumeName || '<pending>'} style={style} />
            case 'capacity':
                const cap = (activeTab === 'persistentvolume' ? item.spec?.capacity : item.status?.capacity)?.storage
                return <TextCell key={colId} content={cap || 'N/A'} style={style} />
            case 'access-modes':
                return <TextCell key={colId} content={item.spec?.accessModes?.join(', ')} style={style} />
            case 'storageclass':
                return <TextCell key={colId} content={item.spec?.storageClassName} style={style} />
            case 'vac':
                return <TextCell key={colId} content={item.spec?.volumeAttributesClassName || '<none>'} style={style} />
            case 'volumemode':
                return <TextCell key={colId} content={item.spec?.volumeMode || '<none>'} style={style} />
            case 'selected-node':
                return <TextCell key={colId} variant="mono" content={item.metadata?.annotations?.['volume.kubernetes.io/selected-node'] || '<none>'} style={style} />
            case 'reclaim-policy':
                const rp = (activeTab === 'persistentvolume' ? item.spec?.persistentVolumeReclaimPolicy : item.reclaimPolicy)
                return <TextCell key={colId} content={rp || '<none>'} style={style} />
            case 'claim':
                const claimRef = item.spec?.claimRef
                const claimContent = claimRef ? `${claimRef.namespace}/${claimRef.name}` : '<none>'
                return <TextCell key={colId} variant="mono" content={claimContent} style={style} />
            case 'reason':
                return <TextCell key={colId} content={item.status?.reason || '<none>'} style={style} />
            case 'class':
                return <TextCell key={colId} content={item.spec?.ingressClassName || item.metadata?.annotations?.['kubernetes.io/ingress.class'] || '<none>'} style={style} />
            case 'hosts':
                return <TextCell key={colId} content={item.spec?.rules?.map((r: any) => r.host).filter(Boolean).join(', ') || '*'} style={style} />
            case 'address':
                return <TextCell key={colId} variant="mono" content={item.status?.loadBalancer?.ingress?.map((i: any) => i.ip || i.hostname).filter(Boolean).join(', ') || '<pending>'} style={style} />
            case 'data':
                return <TextCell key={colId} content={String(Object.keys(item.data || {}).length)} style={style} />
            case 'roles':
                const roles = Object.keys(item.metadata?.labels || {}).filter(l => l.startsWith('node-role.kubernetes.io/')).map(l => l.split('/')[1]).join(', ') || '<none>'
                return <TextCell key={colId} content={roles} style={style} />
            case 'version':
                return <TextCell key={colId} variant="mono" content={item.status?.nodeInfo?.kubeletVersion} style={style} />
            case 'internal-ip':
                return <TextCell key={colId} variant="mono" content={item.status?.addresses?.find((addr: any) => addr.type === 'InternalIP')?.address || '<none>'} style={style} />
            case 'os-image':
                return <TextCell key={colId} content={item.status?.nodeInfo?.osImage} style={style} />
            case 'kernel-version':
                return <TextCell key={colId} variant="mono" content={item.status?.nodeInfo?.kernelVersion} style={style} />
            case 'container-runtime':
                return <TextCell key={colId} variant="mono" content={item.status?.nodeInfo?.containerRuntimeVersion} style={style} />
            default:
                return null
        }
    }

    const currentDefs = COLUMN_DEFINITIONS[activeTab]

    return (
        <tr className="table-row">
            {currentDefs.map(col => renderCell(col.id, col.minWidth))}
        </tr>
    )
}

