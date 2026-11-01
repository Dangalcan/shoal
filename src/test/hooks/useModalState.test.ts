import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalState } from '../../hooks/useModalState';
import { useItemModal } from '../../hooks/useItemModal';
import { createMockPod } from '../helpers/resource-factories';

const podNamed = (name: string) =>
  createMockPod({
    metadata: { name, creationTimestamp: '2026-01-01T00:00:00Z' },
  });

describe('useModalState', () => {
  it('starts with no modal and no selection', () => {
    const { result } = renderHook(() => useModalState());

    expect(result.current.activeModal).toBeNull();
    expect(result.current.selectedItem).toBeNull();
  });

  it.each([
    ['openDescribe', 'describe'],
    ['openYaml', 'yaml'],
    ['openLogs', 'logs'],
    ['openDelete', 'delete'],
    ['openExec', 'exec'],
    ['openForward', 'forward'],
    ['openScale', 'scale'],
  ] as const)('%s opens the %s modal for the item', (opener, modal) => {
    const pod = podNamed('web-1');
    const { result } = renderHook(() => useModalState());

    act(() => result.current[opener](pod));

    expect(result.current.activeModal).toBe(modal);
    expect(result.current.selectedItem).toBe(pod);
  });

  it('switches to another modal and item, then closes everything', () => {
    const first = podNamed('web-1');
    const second = podNamed('web-2');
    const { result } = renderHook(() => useModalState());

    act(() => result.current.openLogs(first));
    act(() => result.current.openYaml(second));
    expect(result.current.activeModal).toBe('yaml');
    expect(result.current.selectedItem).toBe(second);

    act(() => result.current.closeAll());
    expect(result.current.activeModal).toBeNull();
    expect(result.current.selectedItem).toBeNull();
  });
});

describe('useItemModal', () => {
  it('opens with an item and closes back to nothing', () => {
    const { result } = renderHook(() => useItemModal<{ id: number }>());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.item).toBeNull();

    const item = { id: 7 };
    act(() => result.current.open(item));
    expect(result.current.isOpen).toBe(true);
    expect(result.current.item).toBe(item);

    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.item).toBeNull();
  });

  it('counts a falsy item other than null as open', () => {
    const { result } = renderHook(() => useItemModal<number>());

    act(() => result.current.open(0));

    expect(result.current.isOpen).toBe(true);
    expect(result.current.item).toBe(0);
  });
});
