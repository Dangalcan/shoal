import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../utils';
import {
  RestartsCell,
  PodIPCell,
  NodeNameCell,
  NominatedNodeCell,
  ReadinessGatesCell,
} from '../../../../components/resource-tables/cell-renderers/PodCells';
import { mockPods } from '../../../fixtures/resources';

describe('PodCells', () => {
  const style = { width: '100px' };
  const mockPod = mockPods[0]!;

  it('RestartsCell renders restart count', () => {
    render(
      <table>
        <tbody>
          <tr>
            <RestartsCell resource={mockPod as any} style={style} />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('PodIPCell renders IP', () => {
    render(
      <table>
        <tbody>
          <tr>
            <PodIPCell resource={mockPod as any} style={style} />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
  });

  it('NodeNameCell renders node name', () => {
    render(
      <table>
        <tbody>
          <tr>
            <NodeNameCell resource={mockPod as any} style={style} />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('node-A')).toBeInTheDocument();
  });

  const empty = {
    metadata: { name: 'p', creationTimestamp: '2026-01-01T00:00:00Z' },
  } as any;

  it('RestartsCell counts a container without restartCount as 0', () => {
    const pod = {
      ...empty,
      status: {
        phase: 'Running',
        containerStatuses: [{ name: 'app', restartCount: 3 }, { name: 'side' }],
      },
    };
    render(
      <table>
        <tbody>
          <tr>
            <RestartsCell resource={pod} style={style} />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('RestartsCell shows 0 when status is missing', () => {
    render(
      <table>
        <tbody>
          <tr>
            <RestartsCell resource={empty} style={style} />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('PodIPCell and NodeNameCell fall back to <none>', () => {
    const { unmount } = render(
      <table>
        <tbody>
          <tr>
            <PodIPCell resource={empty} style={style} />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('<none>')).toBeInTheDocument();
    unmount();
    render(
      <table>
        <tbody>
          <tr>
            <NodeNameCell resource={empty} style={style} />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('<none>')).toBeInTheDocument();
  });

  it('NominatedNodeCell renders the nominated node or <none>', () => {
    const withNode = {
      ...empty,
      status: { phase: 'Pending', nominatedNodeName: 'node-2' },
    };
    const { unmount } = render(
      <table>
        <tbody>
          <tr>
            <NominatedNodeCell resource={withNode} style={style} />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('node-2')).toBeInTheDocument();
    unmount();
    render(
      <table>
        <tbody>
          <tr>
            <NominatedNodeCell resource={empty} style={style} />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('<none>')).toBeInTheDocument();
  });

  it('ReadinessGatesCell lists gate types or <none>', () => {
    const withGates = {
      ...empty,
      spec: {
        containers: [],
        readinessGates: [
          { conditionType: 'www/ready' },
          { conditionType: 'db/ready' },
        ],
      },
    };
    const { unmount } = render(
      <table>
        <tbody>
          <tr>
            <ReadinessGatesCell resource={withGates} style={style} />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('www/ready, db/ready')).toBeInTheDocument();
    unmount();
    render(
      <table>
        <tbody>
          <tr>
            <ReadinessGatesCell resource={empty} style={style} />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('<none>')).toBeInTheDocument();
  });
});
