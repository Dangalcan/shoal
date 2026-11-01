import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResourceTable } from '../../../components/resource-tables/ResourceTable';

const columns = [
  { id: 'name', label: 'Name', minWidth: 100 },
  { id: 'age', label: 'Age', minWidth: 60 },
];

function renderTable({
  onSort = vi.fn(),
  onResizeTo = vi.fn(),
  widths = {} as Record<string, number>,
} = {}) {
  render(
    <ResourceTable
      columns={columns}
      visibleColumns={['name', 'age']}
      sortConfig={{ key: 'name', direction: 'desc' }}
      onSort={onSort}
      getColumnWidth={(id, width) => widths[id] ?? width}
      onResize={vi.fn()}
      onResizeTo={onResizeTo}
      resizingId={null}
    >
      <tr>
        <td>pod-a</td>
        <td>1d</td>
      </tr>
    </ResourceTable>
  );
  return { onSort, onResizeTo };
}

const nameHandle = () =>
  screen.getByRole('separator', { name: 'Resize Name column' });

describe('ResourceTable keyboard access', () => {
  it('exposes the sort state and sorts from the keyboard', () => {
    const { onSort } = renderTable();
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

  it('exposes each resize handle as a focusable vertical separator', () => {
    renderTable({ widths: { name: 200 } });
    const handle = nameHandle();

    expect(handle).toHaveAttribute('tabindex', '0');
    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    expect(handle).toHaveAttribute('aria-valuenow', '200');
    expect(handle).toHaveAttribute('aria-valuetext', '200 pixels');
    expect(handle).toHaveAttribute('aria-valuemin', '50');
    expect(handle).toHaveAttribute('aria-valuemax', '1000');
    expect(
      screen.getByRole('separator', { name: 'Resize Age column' })
    ).toHaveAttribute('aria-valuenow', '60');

    handle.focus();
    expect(handle).toHaveFocus();
  });

  it('resizes with the arrow keys, by 50 px with Shift; Home restores the default', () => {
    const { onSort, onResizeTo } = renderTable({ widths: { name: 200 } });
    const handle = nameHandle();

    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onResizeTo).toHaveBeenLastCalledWith('name', 210);
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(onResizeTo).toHaveBeenLastCalledWith('name', 190);
    fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true });
    expect(onResizeTo).toHaveBeenLastCalledWith('name', 250);
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
    expect(onResizeTo).toHaveBeenLastCalledWith('name', 150);
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(onResizeTo).toHaveBeenLastCalledWith('name', 100);
    expect(onResizeTo).toHaveBeenCalledTimes(5);

    // None of those keys reached the header cell, which sorts.
    expect(onSort).not.toHaveBeenCalled();
  });

  it('keeps the width between 50 and 1000 px', () => {
    const { onResizeTo } = renderTable({ widths: { name: 55, age: 995 } });

    fireEvent.keyDown(nameHandle(), { key: 'ArrowLeft' });
    expect(onResizeTo).toHaveBeenLastCalledWith('name', 50);
    fireEvent.keyDown(nameHandle(), { key: 'ArrowLeft', shiftKey: true });
    expect(onResizeTo).toHaveBeenLastCalledWith('name', 50);

    const age = screen.getByRole('separator', { name: 'Resize Age column' });
    fireEvent.keyDown(age, { key: 'ArrowRight' });
    expect(onResizeTo).toHaveBeenLastCalledWith('age', 1000);
  });

  it('leaves the other keys to the header cell', () => {
    const { onSort, onResizeTo } = renderTable();
    const handle = nameHandle();

    fireEvent.keyDown(handle, { key: 'Tab' });
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(onResizeTo).not.toHaveBeenCalled();
    expect(onSort).not.toHaveBeenCalled();

    fireEvent.keyDown(handle, { key: 'Enter' });
    expect(onSort).toHaveBeenCalledWith('name');
  });
});
