/**
 * Network resource cell renderers (Services, Ingress)
 */

import React from 'react';
import type { K8sResource, Service, Ingress } from '../../../types/k8s-types';
import { stringField } from '../../../lib/type-guards';
import { TextCell } from '../ResourceCells';

interface CellProps<T> {
  resource: T;
  style: React.CSSProperties;
}

/**
 * Renders service type
 */
export const ServiceTypeCell: React.FC<CellProps<Service>> = ({
  resource,
  style,
}) => {
  const spec = resource.spec || {};
  const serviceType = spec.type || stringField(resource, 'type') || 'ClusterIP';
  return <TextCell key="type" content={serviceType} style={style} />;
};

/**
 * Renders cluster IP
 */
export const ClusterIPCell: React.FC<CellProps<Service>> = ({
  resource,
  style,
}) => {
  const spec = resource.spec || {};
  return (
    <TextCell
      key="cluster-ip"
      variant="mono"
      content={spec.clusterIP || '<none>'}
      style={style}
    />
  );
};

/**
 * Renders external IPs
 */
export const ExternalIPCell: React.FC<CellProps<Service>> = ({
  resource,
  style,
}) => {
  const status = resource.status || {};
  const loadBalancer = status.loadBalancer;
  const externalIPs =
    loadBalancer?.ingress?.map((ing) => ing.ip || ing.hostname).join(', ') ||
    '<none>';
  return (
    <TextCell
      key="external-ip"
      variant="mono"
      content={externalIPs}
      style={style}
    />
  );
};

/**
 * Renders service/ingress ports
 */
export const PortsCell: React.FC<{
  resource: K8sResource;
  resourceType: string;
  style: React.CSSProperties;
}> = ({ resource, resourceType, style }) => {
  if (resourceType === 'ingress') {
    const ingress = resource as Ingress;
    const spec = ingress.spec || {};
    const ports = [];
    if (spec.rules || spec.defaultBackend) ports.push('80');
    if (spec.tls) ports.push('443');
    const ingressPorts =
      stringField(resource, 'ports') || ports.join(', ') || '80';
    return <TextCell key="ports" content={ingressPorts} style={style} />;
  }

  const service = resource as Service;
  const spec = service.spec || {};
  const ports =
    spec.ports
      ?.map((p) => `${p.port}${p.protocol ? '/' + p.protocol : ''}`)
      .join(', ') || '<none>';
  return <TextCell key="ports" content={ports} style={style} />;
};

/**
 * Renders ingress class
 */
export const IngressClassCell: React.FC<CellProps<Ingress>> = ({
  resource,
  style,
}) => {
  const spec = resource.spec || {};
  const annotations = resource.metadata?.annotations || {};
  const ingressClass =
    spec.ingressClassName ||
    annotations['kubernetes.io/ingress.class'] ||
    '<none>';
  return <TextCell key="class" content={ingressClass} style={style} />;
};

/**
 * Renders ingress hosts
 */
export const HostsCell: React.FC<CellProps<Ingress>> = ({
  resource,
  style,
}) => {
  const spec = resource.spec || {};
  const hosts =
    spec.rules
      ?.map((r) => r.host)
      .filter(Boolean)
      .join(', ') || '*';
  return <TextCell key="hosts" content={hosts} style={style} />;
};

/**
 * Renders ingress address
 */
export const AddressCell: React.FC<CellProps<Ingress>> = ({
  resource,
  style,
}) => {
  const status = resource.status || {};
  const ing = status.loadBalancer?.ingress?.[0] || {};
  const address = ing.ip || ing.hostname || '<pending>';
  return (
    <TextCell key="address" variant="mono" content={address} style={style} />
  );
};
