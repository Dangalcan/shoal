import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../utils';
import { StatusCell } from '../../../../components/resource-tables/cell-renderers/StatusCell';
import { mockPods, mockNodes, mockPVC } from '../../../fixtures/k8s-resources';

describe('StatusCell', () => {
  const style = { width: '100px' };
  const mockPod = mockPods[0]!;
  const mockNode = mockNodes[0]!;

  it('renders Pod status', () => {
    render(
      <table>
        <tbody>
          <tr>
            <StatusCell resource={mockPod} resourceType="pods" style={style} />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('renders Node status', () => {
    render(
      <table>
        <tbody>
          <tr>
            <StatusCell
              resource={mockNode}
              resourceType="nodes"
              style={style}
            />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('renders PVC status', () => {
    const mockPvc = { ...mockPVC[0]!, status: { phase: 'Pending' } };
    render(
      <table>
        <tbody>
          <tr>
            <StatusCell
              resource={mockPvc}
              resourceType="persistentvolumeclaim"
              style={style}
            />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders Job status (Complete)', () => {
    const mockJob = {
      kind: 'Job',
      spec: { template: {} },
      status: { succeeded: 1 },
    };
    render(
      <table>
        <tbody>
          <tr>
            <StatusCell
              resource={mockJob as any}
              resourceType="jobs"
              style={style}
            />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('renders Job status (Failed)', () => {
    const mockJob = {
      kind: 'Job',
      spec: { template: {} },
      status: { failed: 1 },
    };
    render(
      <table>
        <tbody>
          <tr>
            <StatusCell
              resource={mockJob as any}
              resourceType="jobs"
              style={style}
            />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders Job status (Running)', () => {
    const mockJob = {
      kind: 'Job',
      spec: { template: {} },
      status: { active: 1, succeeded: 0 },
    };
    render(
      <table>
        <tbody>
          <tr>
            <StatusCell
              resource={mockJob as any}
              resourceType="jobs"
              style={style}
            />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('renders NotReady for a Node whose Ready condition is not True', () => {
    const node = {
      ...mockNode,
      status: {
        ...mockNode.status,
        conditions: [{ type: 'Ready', status: 'False' }],
      },
    };
    render(
      <table>
        <tbody>
          <tr>
            <StatusCell resource={node} resourceType="nodes" style={style} />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('NotReady')).toHaveClass('status-badge-error');
  });

  it('renders Unknown for a Pod without a phase', () => {
    const pod = {
      metadata: {
        name: 'p',
        namespace: 'default',
        creationTimestamp: '2026-01-01T00:00:00Z',
      },
      spec: { containers: [] },
    };
    render(
      <table>
        <tbody>
          <tr>
            <StatusCell resource={pod} resourceType="pods" style={style} />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('Unknown')).toHaveClass('status-badge-other');
  });

  it('renders Unknown for a PVC without a phase', () => {
    const pvc = {
      metadata: {
        name: 'data',
        namespace: 'default',
        creationTimestamp: '2026-01-01T00:00:00Z',
      },
      spec: { resources: { requests: { storage: '1Gi' } } },
    };
    render(
      <table>
        <tbody>
          <tr>
            <StatusCell
              resource={pvc}
              resourceType="persistentvolumeclaim"
              style={style}
            />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('Unknown')).toHaveClass('status-badge-other');
  });

  it('renders Unknown for mismatched types', () => {
    render(
      <table>
        <tbody>
          <tr>
            <StatusCell
              resource={{} as any}
              resourceType="services"
              style={style}
            />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
