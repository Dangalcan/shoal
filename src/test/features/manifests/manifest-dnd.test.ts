import { describe, expect, it, vi } from 'vitest';
import type { DragEvent } from 'react';
import {
  FOLDER_DRAG_TYPE,
  MANIFEST_DRAG_TYPE,
  getDragPayload,
  hasDragType,
  isFileDrag,
  setDragPayload,
} from '../../../features/manifests/manifest-dnd';

function dragEvent(types: string[], getData = () => '') {
  return {
    dataTransfer: {
      types,
      getData,
      setData: vi.fn(),
      effectAllowed: 'none',
    },
  } as unknown as DragEvent;
}

describe('manifest drag helpers', () => {
  it('stores a typed drag payload and marks it as a move', () => {
    const event = dragEvent([]);

    setDragPayload(event, MANIFEST_DRAG_TYPE, 42);

    expect(event.dataTransfer.setData).toHaveBeenCalledWith(
      MANIFEST_DRAG_TYPE,
      '42'
    );
    expect(event.dataTransfer.effectAllowed).toBe('move');
  });

  it('recognizes supported drag types and operating-system file drags', () => {
    const event = dragEvent([MANIFEST_DRAG_TYPE, 'Files']);

    expect(hasDragType(event, MANIFEST_DRAG_TYPE)).toBe(true);
    expect(hasDragType(event, FOLDER_DRAG_TYPE)).toBe(false);
    expect(isFileDrag(event)).toBe(true);
  });

  it('returns only positive integer payloads', () => {
    expect(
      getDragPayload(
        dragEvent([MANIFEST_DRAG_TYPE], () => '7'),
        MANIFEST_DRAG_TYPE
      )
    ).toBe(7);

    for (const raw of ['', '0', '-1', '1.5', 'text']) {
      expect(
        getDragPayload(
          dragEvent([MANIFEST_DRAG_TYPE], () => raw),
          MANIFEST_DRAG_TYPE
        )
      ).toBeNull();
    }
  });
});
