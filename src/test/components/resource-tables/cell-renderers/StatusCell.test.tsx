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
