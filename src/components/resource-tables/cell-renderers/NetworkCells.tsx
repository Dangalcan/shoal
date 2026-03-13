/**
 * Network resource cell renderers (Services, Ingress)
 */

import React from 'react'
import type { K8sResource } from '../../../types/k8s-types'
import { TextCell } from '../ResourceCells'

interface CellProps {
    resource: K8sResource
    style: React.CSSProperties
}

/**
 * Renders service type
 */
export const ServiceTypeCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as Record<string, unknown>).spec || {}
    const serviceType = spec.type || (resource as Record<string, unknown>).type || 'ClusterIP'
    return <TextCell key="type" content={serviceType} style={style} />
}

/**
 * Renders cluster IP
 */
export const ClusterIPCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as Record<string, unknown>).spec || {}
    return <TextCell key="cluster-ip" variant="mono" content={spec.clusterIP || '<none>'} style={style} />
}

/**
 * Renders external IPs
 */
export const ExternalIPCell: React.FC<CellProps> = ({ resource, style }) => {
    const status = (resource as Record<string, unknown>).status || {}
    const loadBalancer = (status.loadBalancer as Record<string, unknown> | undefined)
    const externalIPs = (loadBalancer?.ingress as Record<string, unknown>[] | undefined)
        ?.map((ing) => ing.ip || ing.hostname)
        .join(', ') || '<none>'
    return <TextCell key="external-ip" variant="mono" content={externalIPs} style={style} />
}

/**
 * Renders service/ingress ports
 */
export const PortsCell: React.FC<CellProps & { resourceType: string }> = ({ resource, resourceType, style }) => {
    const spec = (resource as Record<string, unknown>).spec || {}

    if (resourceType === 'ingress') {
        const ports = []
        if (spec.rules || spec.backend) ports.push('80')
        if (spec.tls) ports.push('443')
        const ingressPorts = (resource as Record<string, unknown>).ports || ports.join(', ') || '80'
        return <TextCell key="ports" content={ingressPorts} style={style} />
    }

    const ports = (spec.ports as Record<string, unknown>[] | undefined)
        ?.map((p) => `${p.port}${p.protocol ? '/' + p.protocol : ''}`)
        .join(', ') || '<none>'
    return <TextCell key="ports" content={ports} style={style} />
}

/**
 * Renders ingress class
 */
export const IngressClassCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as Record<string, unknown>).spec || {}
    const annotations = resource.metadata?.annotations || {}
    const ingressClass = spec.ingressClassName || annotations['kubernetes.io/ingress.class'] || '<none>'
    return <TextCell key="class" content={ingressClass} style={style} />
}

/**
 * Renders ingress hosts
 */
export const HostsCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as Record<string, unknown>).spec || {}
    const hosts = (spec.rules as Record<string, unknown>[] | undefined)?.map((r) => r.host).filter(Boolean).join(', ') || '*'
    return <TextCell key="hosts" content={hosts} style={style} />
}

/**
 * Renders ingress address
 */
export const AddressCell: React.FC<CellProps> = ({ resource, style }) => {
    const status = (resource as Record<string, unknown>).status || {}
    const ing = status.loadBalancer?.ingress?.[0] || {}
    const address = ing.ip || ing.hostname || '<pending>'
    return <TextCell key="address" variant="mono" content={address} style={style} />
}
