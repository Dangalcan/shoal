import { useMemo, useState } from 'react';
import type { Manifest, ManifestFolder } from '../../types.d';
import type { UseManifestFoldersResult } from './useManifestFolders';

export type FolderNameModalState =
  { mode: 'create' } | { mode: 'rename'; folder: ManifestFolder } | null;

export type MoveTarget =
  | { kind: 'manifest'; manifest: Manifest }
  | { kind: 'folder'; folder: ManifestFolder }
  | null;

export interface MoveDialogProps {
  itemName: string;
  /** Folders a folder cannot be moved into: itself and its descendants. */
  disabledIds: Set<number> | undefined;
  currentLocationId: number | null;
}

export interface UseManifestFolderDialogsResult {
  folderNameModal: FolderNameModalState;
  createFolder: () => void;
  renameFolder: (folder: ManifestFolder) => void;
  closeFolderName: () => void;
  submitFolderName: (name: string) => Promise<void>;
  deleteFolderTarget: ManifestFolder | null;
  requestDeleteFolder: (folder: ManifestFolder) => void;
  closeDeleteFolder: () => void;
  moveDialog: MoveDialogProps | null;
  moveManifest: (manifest: Manifest) => void;
  moveFolder: (folder: ManifestFolder) => void;
  closeMove: () => void;
  move: (targetFolderId: number | null) => Promise<void>;
}

/** The create, rename, delete and move dialogs of the manifest folders. */
export function useManifestFolderDialogs(
  folders: UseManifestFoldersResult
): UseManifestFolderDialogsResult {
  const [folderNameModal, setFolderNameModal] =
    useState<FolderNameModalState>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] =
    useState<ManifestFolder | null>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTarget>(null);
  const { getSubtreeIds } = folders;

  const submitFolderName = async (name: string) => {
    if (folderNameModal?.mode === 'rename') {
      await folders.renameFolder(folderNameModal.folder.id, name);
    } else {
      await folders.createFolder(name);
    }
  };

  const move = async (targetFolderId: number | null) => {
    if (!moveTarget) return;
    if (moveTarget.kind === 'manifest') {
      await folders.moveManifestToFolder(
        moveTarget.manifest.id,
        targetFolderId
      );
    } else {
      await folders.moveFolder(moveTarget.folder.id, targetFolderId);
    }
  };

  const moveDialog = useMemo<MoveDialogProps | null>(() => {
    if (!moveTarget) return null;
    if (moveTarget.kind === 'manifest') {
      return {
        itemName: moveTarget.manifest.name,
        disabledIds: undefined,
        currentLocationId: moveTarget.manifest.folder_id ?? null,
      };
    }
    return {
      itemName: moveTarget.folder.name,
      disabledIds: getSubtreeIds(moveTarget.folder.id),
      currentLocationId: moveTarget.folder.parent_id,
    };
  }, [moveTarget, getSubtreeIds]);

  return {
    folderNameModal,
    createFolder: () => setFolderNameModal({ mode: 'create' }),
    renameFolder: (folder) => setFolderNameModal({ mode: 'rename', folder }),
    closeFolderName: () => setFolderNameModal(null),
    submitFolderName,
    deleteFolderTarget,
    requestDeleteFolder: setDeleteFolderTarget,
    closeDeleteFolder: () => setDeleteFolderTarget(null),
    moveDialog,
    moveManifest: (manifest) => setMoveTarget({ kind: 'manifest', manifest }),
    moveFolder: (folder) => setMoveTarget({ kind: 'folder', folder }),
    closeMove: () => setMoveTarget(null),
    move,
  };
}
