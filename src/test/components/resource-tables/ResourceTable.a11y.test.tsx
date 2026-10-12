import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResourceTable } from '../../../components/resource-tables/ResourceTable';

const columns = [
  { id: 'name', label: 'Name', minWidth: 100 },
  { id: 'age', label: 'Age', minWidth: 60 },
];

function renderTable(onSort = vi.fn()) {
  render(
    <ResourceTable
      columns={columns}
      visibleColumns={['name', 'age']}
      sortConfig={{ key: 'name', direction: 'desc' }}
      onSort={onSort}
      getColumnWidth={(_id, width) => width}
      onResize={vi.fn()}
      resizingId={null}
    >
      <tr>
        <td>pod-a</td>
        <td>1d</td>
      </tr>
    </ResourceTable>
  );
  return onSort;
}

describe('ResourceTable keyboard access', () => {
  it('exposes the sort state and sorts from the keyboard', () => {
    const onSort = renderTable();
    const name = screen.getByRole('columnheader', { name: /name/i });
    const age = screen.getByRole('columnheader', { name: /age/i });

    expect(name).toHaveAttribute('aria-sort', 'descending');
    expect(age).toHaveAttribute('aria-sort', 'none');
    expect(name).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(age, { key: 'Enter' });
    expect(onSort).toHaveBeenCalledWith('age');
    fireEvent.keyDown(name, { key: ' ' });
    expect(onSort).toHaveBeenCalledWith('name');
    fireEvent.keyDown(name, { key: 'Tab' });
    expect(onSort).toHaveBeenCalledTimes(2);
  });
});
