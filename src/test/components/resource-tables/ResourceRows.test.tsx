import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../utils';
import { ResourceRow } from '../../../components/resource-tables/ResourceRows';
import { mockPods } from '../../fixtures/k8s-resources';

// Mock NameCell to simplify testing and avoid deep rendering issues
vi.mock('../../../components/resource-tables/ResourceCells', () => ({
  NameCell: ({ name, actions }: any) => (
    <td>
      {name}
      <button onClick={actions.onDelete}>Delete</button>
      <button onClick={actions.onDescribe}>Describe</button>
      <button onClick={actions.onYaml}>Yaml</button>
      {actions.onLogs && <button onClick={actions.onLogs}>Logs</button>}
      {actions.onExec && <button onClick={actions.onExec}>Exec</button>}
      {actions.onForward && (
        <button onClick={actions.onForward}>Forward</button>
      )}
      {actions.onRestart && (
        <button onClick={actions.onRestart}>Restart</button>
      )}
      {actions.onScale && <button onClick={actions.onScale}>Scale</button>}
      <span data-testid="flags">
        {[
          actions.showRestart && 'restart',
          actions.showScale && 'scale',
          actions.showLogs && 'logs',
          actions.showExec && 'exec',
          actions.showForward && 'forward',
        ]
          .filter(Boolean)
          .join(',')}
      </span>
    </td>
  ),
}));

// Mock renderCell
vi.mock(
  '../../../components/resource-tables/cell-renderers/cell-renderers/renderCell',
  () => ({
    renderCell: ({ colId }: any) => <td key={colId}>{colId}-content</td>,
  })
);
vi.mock(
  '../../../components/resource-tables/cell-renderers/renderCell',
  () => ({
    renderCell: ({ colId }: any) => <td key={colId}>{colId}-content</td>,
  })
);

describe('ResourceRow', () => {
  const mockPod = mockPods[0]!;
  const defaultProps = {
    item: mockPod,
    activeTab: 'pods' as const,
    visibleColumns: ['name', 'status', 'age'],
    getColumnWidth: () => 100,
    onDescribe: vi.fn(),
    onYaml: vi.fn(),
    onRestart: vi.fn(),
    onLogs: vi.fn(),
    onDelete: vi.fn(),
  };

  it('should render row with name cell', () => {
    render(
      <table>
        <tbody>
          <ResourceRow {...defaultProps} />
        </tbody>
      </table>
    );
    expect(screen.getByText(mockPod.metadata.name)).toBeInTheDocument();
  });

  it('should call actions correctly', () => {
    render(
      <table>
        <tbody>
          <ResourceRow {...defaultProps} />
        </tbody>
      </table>
    );

    fireEvent.click(screen.getByText('Delete'));
    expect(defaultProps.onDelete).toHaveBeenCalledWith(mockPod);

    fireEvent.click(screen.getByText('Describe'));
    expect(defaultProps.onDescribe).toHaveBeenCalledWith(mockPod);
  });

  it('wires pod-specific actions (logs/exec/forward) with the row item', () => {
    const onLogs = vi.fn();
    const onExec = vi.fn();
    const onForward = vi.fn();
    render(
      <table>
        <tbody>
          <ResourceRow
            {...defaultProps}
            onLogs={onLogs}
            onExec={onExec}
            onForward={onForward}
          />
        </tbody>
      </table>
    );

    fireEvent.click(screen.getByText('Logs'));
    fireEvent.click(screen.getByText('Exec'));
    fireEvent.click(screen.getByText('Forward'));
    fireEvent.click(screen.getByText('Yaml'));

    expect(onLogs).toHaveBeenCalledWith(mockPod);
    expect(onExec).toHaveBeenCalledWith(mockPod);
    expect(onForward).toHaveBeenCalledWith(mockPod);
    expect(defaultProps.onYaml).toHaveBeenCalledWith(mockPod);
    expect(screen.getByTestId('flags').textContent).toBe('logs,exec,forward');
  });

  it('shows restart and scale for deployments and wires them', () => {
    const onScale = vi.fn();
    render(
      <table>
        <tbody>
          <ResourceRow
            {...defaultProps}
            activeTab={'deployments' as any}
            onScale={onScale}
          />
        </tbody>
      </table>
    );

    fireEvent.click(screen.getByText('Restart'));
    fireEvent.click(screen.getByText('Scale'));

    expect(defaultProps.onRestart).toHaveBeenCalledWith(mockPod);
    expect(onScale).toHaveBeenCalledWith(mockPod);
    expect(screen.getByTestId('flags').textContent).toBe('restart,scale');
  });

  it('omits optional action callbacks that were not provided', () => {
    render(
      <table>
        <tbody>
          <ResourceRow
            item={mockPod}
            activeTab={'pods' as const}
            visibleColumns={['name']}
            getColumnWidth={() => 100}
            onDescribe={vi.fn()}
            onYaml={vi.fn()}
            onDelete={vi.fn()}
          />
        </tbody>
      </table>
    );

    expect(screen.queryByText('Logs')).toBeNull();
    expect(screen.queryByText('Exec')).toBeNull();
    expect(screen.queryByText('Forward')).toBeNull();
    expect(screen.queryByText('Restart')).toBeNull();
    expect(screen.queryByText('Scale')).toBeNull();
  });
});
