import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
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

  const storedWidths = () =>
    JSON.parse(window.localStorage.getItem('columnWidths') ?? '{}') as Record<
      string,
      number
    >;

  it('stores a width within 50–1000 px and persists it', () => {
    const { result } = renderHook(() => useTableState(podColumns));
    expect(result.current.getColumnWidth('name', 200)).toBe(200);

    act(() => result.current.handleResize('name', 320));
    expect(result.current.getColumnWidth('name', 200)).toBe(320);
    expect(storedWidths()).toEqual({ name: 320 });

    act(() => result.current.handleResize('name', 10));
    expect(result.current.getColumnWidth('name', 200)).toBe(50);
    act(() => result.current.handleResize('name', 5000));
    expect(result.current.getColumnWidth('name', 200)).toBe(1000);
    expect(storedWidths()).toEqual({ name: 1000 });
  });

  it('reads the persisted widths back on the next mount', () => {
    const first = renderHook(() => useTableState(podColumns));
    act(() => first.result.current.handleResize('status', 120));
    first.unmount();

    const second = renderHook(() => useTableState(podColumns));
    expect(second.result.current.getColumnWidth('status', 80)).toBe(120);
    expect(second.result.current.getColumnWidth('name', 200)).toBe(200);
  });

  it('bounds a mouse drag the same way', () => {
    const { result } = renderHook(() => useTableState(podColumns));
    const event = {
      preventDefault: vi.fn(),
      clientX: 300,
    } as unknown as ReactMouseEvent;

    act(() => result.current.onResizeStart(event, 'name', 200));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.resizingId).toBe('name');

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 0 }));
    });
    expect(result.current.getColumnWidth('name', 200)).toBe(50);

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
    expect(result.current.resizingId).toBeNull();
    expect(storedWidths()).toEqual({ name: 50 });
  });
});
