import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../utils';
import { ResourceTable } from '../../../components/resource-tables/ResourceTable';

describe('ResourceTable', () => {
  const columns = [
    { id: 'name', label: 'Name', minWidth: 100 },
    { id: 'status', label: 'Status', minWidth: 80 },
  ];
  const defaultProps = {
    columns,
    visibleColumns: ['name', 'status'],
    sortConfig: { key: 'name', direction: 'asc' as const },
    onSort: vi.fn(),
    getColumnWidth: (_id: string, def: number) => def,
    onResize: vi.fn(),
    resizingId: null,
  };

  it('should render headers correctly', () => {
    render(
      <ResourceTable {...defaultProps}>
        <tr>
          <td>Content</td>
        </tr>
      </ResourceTable>
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('should handle sorting click', () => {
    render(
      <ResourceTable {...defaultProps}>
        <tr>
          <td>Content</td>
        </tr>
      </ResourceTable>
    );
    fireEvent.click(screen.getByText('Name'));
    expect(defaultProps.onSort).toHaveBeenCalledWith('name');
  });

  it('should not render hidden columns', () => {
    render(
      <ResourceTable {...defaultProps} visibleColumns={['name']}>
        <tr>
          <td>Content</td>
        </tr>
      </ResourceTable>
    );
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
  });

  it('should display children content', () => {
    render(
      <ResourceTable {...defaultProps}>
        <tr>
          <td>Child Row</td>
        </tr>
      </ResourceTable>
    );
    expect(screen.getByText('Child Row')).toBeInTheDocument();
  });
});
