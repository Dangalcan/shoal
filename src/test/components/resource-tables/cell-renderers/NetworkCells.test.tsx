import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ServiceTypeCell,
  ClusterIPCell,
  ExternalIPCell,
  PortsCell,
  IngressClassCell,
  HostsCell,
  AddressCell,
} from '../../../../components/resource-tables/cell-renderers/NetworkCells';
import { K8sResource } from '../../../../types/k8s-types';

// Mock specific cell components to avoid full rendering complexity if needed,
// but for these simple cells, rendering them is fine.
// We mock TextCell to simplify assertions if we want, but testing the output is better.

describe('NetworkCells', () => {
  const emptyResource: K8sResource = {
    kind: 'Service',
    apiVersion: 'v1',
    metadata: {
      name: 'test-service',
      uid: '123',
      creationTimestamp: '2023-01-01T00:00:00Z',
    },
  } as any; // Cast to allowing missing fields for sparse testing

  const style = {};

  describe('ServiceTypeCell', () => {
    it('should render correct type', () => {
      const resource = { ...emptyResource, spec: { type: 'NodePort' } };
      render(<ServiceTypeCell resource={resource as any} style={style} />);
      expect(screen.getByText('NodePort')).toBeInTheDocument();
    });

    it('should fallback to ClusterIP if type missing', () => {
      render(<ServiceTypeCell resource={emptyResource as any} style={style} />);
      expect(screen.getByText('ClusterIP')).toBeInTheDocument();
    });
  });

  describe('ClusterIPCell', () => {
    it('should render IP', () => {
      const resource = { ...emptyResource, spec: { clusterIP: '1.2.3.4' } };
      render(<ClusterIPCell resource={resource as any} style={style} />);
      expect(screen.getByText('1.2.3.4')).toBeInTheDocument();
    });

    it('should render <none> if missing', () => {
      render(<ClusterIPCell resource={emptyResource as any} style={style} />);
      expect(screen.getByText('<none>')).toBeInTheDocument();
    });
  });

  describe('ExternalIPCell', () => {
    it('should render external IPs from LoadBalancer', () => {
      const resource = {
        ...emptyResource,
        status: {
          loadBalancer: {
            ingress: [{ ip: '10.0.0.1' }, { hostname: 'example.com' }],
          },
        },
      };
      render(<ExternalIPCell resource={resource as any} style={style} />);
      expect(screen.getByText('10.0.0.1, example.com')).toBeInTheDocument();
    });

    it('should render <none> if missing', () => {
      render(<ExternalIPCell resource={emptyResource as any} style={style} />);
      expect(screen.getByText('<none>')).toBeInTheDocument();
    });
  });

  describe('PortsCell', () => {
    it('should render ports for Service', () => {
      const resource = {
        ...emptyResource,
        spec: { ports: [{ port: 80, protocol: 'TCP' }, { port: 443 }] },
      };
      render(
        <PortsCell
          resource={resource as any}
          resourceType="services"
          style={style}
        />
      );
      expect(screen.getByText('80/TCP, 443')).toBeInTheDocument();
    });

    it('should render inferred ports for Ingress', () => {
      const resource = {
        ...emptyResource,
        spec: { rules: [{ host: 'test' }] },
      };
      render(
        <PortsCell
          resource={resource as any}
          resourceType="ingress"
          style={style}
        />
      );
      expect(screen.getByText('80')).toBeInTheDocument();
    });

    it('should render 443 for Ingress with TLS', () => {
      const resource = {
        ...emptyResource,
        spec: { tls: [{ hosts: ['test'] }] },
      };
      render(
        <PortsCell
          resource={resource as any}
          resourceType="ingress"
          style={style}
        />
      );
      expect(screen.getByText('443')).toBeInTheDocument();
    });
  });

  describe('IngressClassCell', () => {
    it('should render ingressClassName', () => {
      const resource = {
        ...emptyResource,
        spec: { ingressClassName: 'nginx' },
      };
      render(<IngressClassCell resource={resource as any} style={style} />);
      expect(screen.getByText('nginx')).toBeInTheDocument();
    });

    it('should fall back to annotation', () => {
      const resource = {
        ...emptyResource,
        metadata: {
          ...emptyResource.metadata,
          annotations: { 'kubernetes.io/ingress.class': 'alb' },
        },
      };
      render(<IngressClassCell resource={resource as any} style={style} />);
      expect(screen.getByText('alb')).toBeInTheDocument();
    });

    it('should render <none> if missing', () => {
      render(
        <IngressClassCell resource={emptyResource as any} style={style} />
      );
      expect(screen.getByText('<none>')).toBeInTheDocument();
    });
  });

  describe('HostsCell', () => {
    it('should render hosts', () => {
      const resource = {
        ...emptyResource,
        spec: { rules: [{ host: 'a.com' }, { host: 'b.com' }] },
      };
      render(<HostsCell resource={resource as any} style={style} />);
      expect(screen.getByText('a.com, b.com')).toBeInTheDocument();
    });

    it('should render * if no rules/hosts', () => {
      render(<HostsCell resource={emptyResource as any} style={style} />);
      expect(screen.getByText('*')).toBeInTheDocument();
    });
  });

  describe('AddressCell', () => {
    it('should render ingress address', () => {
      const resource = {
        ...emptyResource,
        status: { loadBalancer: { ingress: [{ ip: '1.2.3.4' }] } },
      };
      render(<AddressCell resource={resource as any} style={style} />);
      expect(screen.getByText('1.2.3.4')).toBeInTheDocument();
    });

    it('should render <pending> if missing', () => {
      render(<AddressCell resource={emptyResource as any} style={style} />);
      expect(screen.getByText('<pending>')).toBeInTheDocument();
    });
  });
});
