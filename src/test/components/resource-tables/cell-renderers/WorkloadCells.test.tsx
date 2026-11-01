import type { ReactElement } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ResourceType } from '../../../../lib/resources/resource-definitions';
import {
  ReadyCell,
  DesiredCell,
  CurrentCell,
  UpdatedCell,
  AvailableCell,
  CompletionsCell,
  DurationCell,
} from '../../../../components/resource-tables/cell-renderers/WorkloadCells';
import { K8sResource } from '../../../../types/k8s-types';

describe('WorkloadCells', () => {
  const emptyResource: K8sResource = {
    kind: 'Deployment',
    apiVersion: 'apps/v1',
    metadata: {
      name: 'test-deploy',
      uid: '123',
      creationTimestamp: '2023-01-01T00:00:00Z',
    },
  } as any;

  const style = {};

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ReadyCell', () => {
    it('should render ready/replicas for standard workloads', () => {
      const resource = {
        ...emptyResource,
        status: { readyReplicas: 2, replicas: 3 },
      };
      render(
        <ReadyCell
          resource={resource as any}
          resourceType="deployments"
          style={style}
        />
      );
      expect(screen.getByText('2 / 3')).toBeInTheDocument();
    });

    it('should render just ready replicas for replicasets', () => {
      const resource = { ...emptyResource, status: { readyReplicas: 5 } };
      render(
        <ReadyCell
          resource={resource as any}
          resourceType="replicasets"
          style={style}
        />
      );
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should render numberReady for daemonsets', () => {
      const resource = { ...emptyResource, status: { numberReady: 4 } };
      render(
        <ReadyCell
          resource={resource as any}
          resourceType="daemonsets"
          style={style}
        />
      );
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('should handle sparse data', () => {
      render(
        <ReadyCell
          resource={emptyResource as any}
          resourceType="deployments"
          style={style}
        />
      );
      expect(screen.getByText('0 / 0')).toBeInTheDocument();
    });
  });

  describe('DesiredCell', () => {
    it('should render spec replicas', () => {
      const resource = { ...emptyResource, spec: { replicas: 3 } };
      render(
        <DesiredCell
          resource={resource as any}
          resourceType="deployments"
          style={style}
        />
      );
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render desiredNumberScheduled for daemonsets', () => {
      const resource = {
        ...emptyResource,
        status: { desiredNumberScheduled: 2 },
      };
      render(
        <DesiredCell
          resource={resource as any}
          resourceType="daemonsets"
          style={style}
        />
      );
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('CurrentCell', () => {
    it('should render status replicas', () => {
      const resource = { ...emptyResource, status: { replicas: 3 } };
      render(
        <CurrentCell
          resource={resource as any}
          resourceType="deployments"
          style={style}
        />
      );
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render currentNumberScheduled for daemonsets', () => {
      const resource = {
        ...emptyResource,
        status: { currentNumberScheduled: 2 },
      };
      render(
        <CurrentCell
          resource={resource as any}
          resourceType="daemonsets"
          style={style}
        />
      );
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('UpdatedCell', () => {
    it('should render updated replicas', () => {
      const resource = { ...emptyResource, status: { updatedReplicas: 3 } };
      render(
        <UpdatedCell
          resource={resource as any}
          resourceType="deployments"
          style={style}
        />
      );
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render updatedNumberScheduled for daemonsets', () => {
      const resource = {
        ...emptyResource,
        status: { updatedNumberScheduled: 2 },
      };
      render(
        <UpdatedCell
          resource={resource as any}
          resourceType="daemonsets"
          style={style}
        />
      );
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('AvailableCell', () => {
    it('should render available replicas', () => {
      const resource = { ...emptyResource, status: { availableReplicas: 3 } };
      render(
        <AvailableCell
          resource={resource as any}
          resourceType="deployments"
          style={style}
        />
      );
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render numberAvailable for daemonsets', () => {
      const resource = { ...emptyResource, status: { numberAvailable: 2 } };
      render(
        <AvailableCell
          resource={resource as any}
          resourceType="daemonsets"
          style={style}
        />
      );
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('CompletionsCell', () => {
    it('should render completions', () => {
      const resource = {
        ...emptyResource,
        status: { succeeded: 1 },
        spec: { completions: 1 },
      };
      render(<CompletionsCell resource={resource as any} style={style} />);
      expect(screen.getByText('1 / 1')).toBeInTheDocument();
    });

    it('should default completions to 1 and succeeded to 0', () => {
      render(<CompletionsCell resource={emptyResource as any} style={style} />);
      expect(screen.getByText('0 / 1')).toBeInTheDocument();
    });
  });

  describe('DurationCell', () => {
    it('should render duration', () => {
      const start = new Date(Date.now() - 5000).toISOString();
      const end = new Date().toISOString();
      const resource = {
        ...emptyResource,
        status: { startTime: start, completionTime: end },
      };
      render(<DurationCell resource={resource as any} style={style} />);
      // Should be approx 5s, but we can't perfectly assert exact seconds due to execution time.
      // We'll check it contains 's' and a number
      expect(screen.getByText(/\ds$/)).toBeInTheDocument();
    });

    it('should render - if no start time', () => {
      render(<DurationCell resource={emptyResource as any} style={style} />);
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('measures a finished job from start to completion', () => {
      const resource = {
        ...emptyResource,
        status: {
          startTime: '2026-01-01T00:00:00Z',
          completionTime: '2026-01-01T00:01:05Z',
        },
      };
      renderInRow(<DurationCell resource={resource} style={style} />);
      expect(screen.getByRole('cell')).toHaveTextContent('65s');
    });

    it('measures a running job up to now', () => {
      vi.spyOn(Date, 'now').mockReturnValue(
        new Date('2026-01-01T00:00:42Z').getTime()
      );
      const resource = {
        ...emptyResource,
        status: { startTime: '2026-01-01T00:00:00Z' },
      };
      renderInRow(<DurationCell resource={resource} style={style} />);
      expect(screen.getByRole('cell')).toHaveTextContent('42s');
    });
  });

  describe('missing counters', () => {
    const cells = [
      ['ReadyCell', ReadyCell],
      ['DesiredCell', DesiredCell],
      ['CurrentCell', CurrentCell],
      ['UpdatedCell', UpdatedCell],
      ['AvailableCell', AvailableCell],
    ] as const;
    const types: ResourceType[] = ['replicasets', 'daemonsets'];

    it.each(
      cells.flatMap(([name, Cell]) =>
        types.map((type) => ({ name, Cell, type }))
      )
    )('$name shows 0 for a $type without counters', ({ Cell, type }) => {
      renderInRow(
        <Cell resource={emptyResource} resourceType={type} style={style} />
      );
      expect(screen.getByRole('cell')).toHaveTextContent(/^0$/);
    });

    it('ReadyCell shows the replica count when no replica is ready', () => {
      const resource = { ...emptyResource, status: { replicas: 2 } };
      renderInRow(
        <ReadyCell
          resource={resource}
          resourceType="statefulsets"
          style={style}
        />
      );
      expect(screen.getByRole('cell')).toHaveTextContent('0 / 2');
    });
  });
});

function renderInRow(cell: ReactElement) {
  return render(
    <table>
      <tbody>
        <tr>{cell}</tr>
      </tbody>
    </table>
  );
}
