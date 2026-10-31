import { FolderNameModal } from './FolderNameModal';
import { DeleteFolderModal } from './DeleteFolderModal';
import { MoveToFolderModal } from './MoveToFolderModal';
import type { UseManifestFoldersResult } from './useManifestFolders';
import type { UseManifestFolderDialogsResult } from './useManifestFolderDialogs';

interface ManifestFolderDialogsProps {
  folders: UseManifestFoldersResult;
  dialogs: UseManifestFolderDialogsResult;
}

/** The folder dialogs that are open, if any: create or rename, delete, move. */
export function ManifestFolderDialogs({
  folders,
  dialogs,
}: ManifestFolderDialogsProps) {
  return (
    <>
      {dialogs.folderNameModal && (
        <FolderNameModal
          onClose={dialogs.closeFolderName}
          initialName={
            dialogs.folderNameModal.mode === 'rename'
              ? dialogs.folderNameModal.folder.name
              : ''
          }
          onSubmit={dialogs.submitFolderName}
        />
      )}

      {dialogs.deleteFolderTarget && (
        <DeleteFolderModal
          folder={dialogs.deleteFolderTarget}
          onClose={dialogs.closeDeleteFolder}
          onConfirm={folders.deleteFolder}
        />
      )}

      {dialogs.moveDialog && (
        <MoveToFolderModal
          onClose={dialogs.closeMove}
          itemName={dialogs.moveDialog.itemName}
          folders={folders.folders}
          disabledIds={dialogs.moveDialog.disabledIds}
          currentLocationId={dialogs.moveDialog.currentLocationId}
          onMove={dialogs.move}
        />
      )}
    </>
  );
}
