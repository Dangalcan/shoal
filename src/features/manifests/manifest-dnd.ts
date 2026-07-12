/**
 * Drag & drop helpers for the Manifests page.
 *
 * Custom MIME types distinguish internal card drags from OS file drops
 * (which use the 'Files' type) so the page-level YAML drop zone and the
 * folder drop targets don't fight over the same events.
 */

export const MANIFEST_DRAG_TYPE = 'application/x-k8s-manifest-id';
export const FOLDER_DRAG_TYPE = 'application/x-k8s-manifest-folder-id';

export function setDragPayload(
  e: React.DragEvent,
  type: string,
  id: number
): void {
  e.dataTransfer.setData(type, String(id));
  e.dataTransfer.effectAllowed = 'move';
}

/** Usable during dragover/dragenter, where getData() is not available. */
export function hasDragType(e: React.DragEvent, type: string): boolean {
  return Array.from(e.dataTransfer.types).includes(type);
}

/** Only valid inside a drop handler. Returns null if the type is absent. */
export function getDragPayload(
  e: React.DragEvent,
  type: string
): number | null {
  const raw = e.dataTransfer.getData(type);
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function isFileDrag(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes('Files');
}
