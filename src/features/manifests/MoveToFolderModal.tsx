import { useMemo, useState } from 'react';
import { Folder, FolderInput, Home } from 'lucide-react';
import { BaseModal } from '../../components/modals/BaseModal';
import type { ManifestFolder } from '../../types.d';

/**
 * Rendered only while open (the parent mounts it conditionally), so the
 * selection resets on every open.
 */
interface MoveToFolderModalProps {
  onClose: () => void;
  /** Name of the manifest or folder being moved, for the subtitle. */
  itemName: string;
  folders: ManifestFolder[];
  /** Folder ids that cannot be a destination (a moved folder and its subtree). */
  disabledIds?: Set<number>;
  /** Where the item currently lives; shown as disabled. */
  currentLocationId: number | null;
  onMove: (targetFolderId: number | null) => void;
}

interface TreeNode {
  folder: ManifestFolder;
  depth: number;
}

function flattenTree(folders: ManifestFolder[]): TreeNode[] {
  const byParent = new Map<number | null, ManifestFolder[]>();
  for (const folder of folders) {
    const list = byParent.get(folder.parent_id) ?? [];
    list.push(folder);
    byParent.set(folder.parent_id, list);
  }

  const result: TreeNode[] = [];
  const walk = (parentId: number | null, depth: number, seen: Set<number>) => {
    for (const folder of byParent.get(parentId) ?? []) {
      if (seen.has(folder.id)) continue;
      seen.add(folder.id);
      result.push({ folder, depth });
      walk(folder.id, depth + 1, seen);
    }
  };
  walk(null, 0, new Set());
  return result;
}

export function MoveToFolderModal({
  onClose,
  itemName,
  folders,
  disabledIds,
  currentLocationId,
  onMove,
}: MoveToFolderModalProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hasSelection, setHasSelection] = useState(false);

  const tree = useMemo(() => flattenTree(folders), [folders]);

  const isDisabled = (id: number | null) =>
    id === currentLocationId || (id !== null && !!disabledIds?.has(id));

  const select = (id: number | null) => {
    if (isDisabled(id)) return;
    setSelectedId(id);
    setHasSelection(true);
  };

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title="Move to Folder"
      subtitle={`Choose a destination for "${itemName}"`}
      icon={<FolderInput size={20} />}
      maxWidth="480px"
      footer={
        <>
          <button className="close-footer-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn--primary btn--md"
            disabled={!hasSelection}
            onClick={() => {
              onMove(selectedId);
              onClose();
            }}
          >
            Move Here
          </button>
        </>
      }
    >
      <div className="move-folder-tree" role="listbox" aria-label="Folders">
        <button
          className={`move-folder-tree__item ${
            hasSelection && selectedId === null
              ? 'move-folder-tree__item--selected'
              : ''
          }`}
          role="option"
          aria-selected={hasSelection && selectedId === null}
          disabled={isDisabled(null)}
          onClick={() => select(null)}
        >
          <Home size={16} />
          <span>All Manifests</span>
        </button>
        {tree.map(({ folder, depth }) => (
          <button
            key={folder.id}
            className={`move-folder-tree__item ${
              hasSelection && selectedId === folder.id
                ? 'move-folder-tree__item--selected'
                : ''
            }`}
            role="option"
            aria-selected={hasSelection && selectedId === folder.id}
            style={{ paddingLeft: `${1 + depth * 1.25}rem` }}
            disabled={isDisabled(folder.id)}
            onClick={() => select(folder.id)}
          >
            <Folder size={16} />
            <span>{folder.name}</span>
          </button>
        ))}
      </div>
    </BaseModal>
  );
}
