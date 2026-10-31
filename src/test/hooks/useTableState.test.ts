import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableState } from '../../hooks/useTableState';

/**
 * Column visibility follows the active tab's defaults; the user's toggles
 * belong to the tab they were made on.
 */
describe('useTableState', () => {
  const podColumns = ['namespace', 'name', 'status'];
  const nodeColumns = ['name', 'roles', 'version'];

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows the defaults and applies toggles to them', () => {
    const { result } = renderHook(() => useTableState(podColumns));
    expect(result.current.visibleColumns).toEqual(podColumns);

    act(() => result.current.handleColumnToggle('status'));
    expect(result.current.visibleColumns).toEqual(['namespace', 'name']);

    act(() => result.current.handleColumnToggle('age'));
    expect(result.current.visibleColumns).toEqual(['namespace', 'name', 'age']);
  });

  it('never hides the last column', () => {
    const { result } = renderHook(() => useTableState(['name']));

    act(() => result.current.handleColumnToggle('name'));

    expect(result.current.visibleColumns).toEqual(['name']);
  });

  it('switches to the new defaults when the tab changes', () => {
    const { result, rerender } = renderHook(
      ({ defaults }: { defaults: string[] }) => useTableState(defaults),
      { initialProps: { defaults: podColumns } }
    );
    act(() => result.current.handleColumnToggle('status'));
    expect(result.current.visibleColumns).toEqual(['namespace', 'name']);

    rerender({ defaults: nodeColumns });
    expect(result.current.visibleColumns).toEqual(nodeColumns);

    // Toggles made on the new tab belong to it...
    act(() => result.current.handleColumnToggle('version'));
    expect(result.current.visibleColumns).toEqual(['name', 'roles']);

    // ...and coming back shows the pod defaults again, not the earlier toggle.
    rerender({ defaults: podColumns });
    expect(result.current.visibleColumns).toEqual(podColumns);
  });

  it('keeps the current columns for a tab without defaults', () => {
    const { result, rerender } = renderHook(
      ({ defaults }: { defaults: string[] }) => useTableState(defaults),
      { initialProps: { defaults: podColumns } }
    );
    act(() => result.current.handleColumnToggle('status'));

    rerender({ defaults: [] });
    expect(result.current.visibleColumns).toEqual(['namespace', 'name']);

    act(() => result.current.handleColumnToggle('age'));
    expect(result.current.visibleColumns).toEqual(['namespace', 'name', 'age']);
  });

  it('sorts by a column and flips the direction on repeat', () => {
    const { result } = renderHook(() => useTableState(podColumns));

    act(() => result.current.handleSort('name'));
    expect(result.current.sortConfig).toEqual({
      key: 'name',
      direction: 'asc',
    });

    act(() => result.current.handleSort('name'));
    expect(result.current.sortConfig).toEqual({
      key: 'name',
      direction: 'desc',
    });
  });
});
