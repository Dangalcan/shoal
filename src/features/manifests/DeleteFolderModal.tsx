import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BaseModal } from '../../components/modals/BaseModal';
import type { FolderDeleteMode, ManifestFolder } from '../../types.d';

/**
 * Rendered only while open (the parent mounts it conditionally), so the
 * checkbox resets on every open.
 */
interface DeleteFolderModalProps {
  folder: ManifestFolder;
  onClose: () => void;
  onConfirm: (id: number, mode: FolderDeleteMode) => void;
}

export function DeleteFolderModal({
  folder,
  onClose,
  onConfirm,
}: DeleteFolderModalProps) {
  const [deleteContents, setDeleteContents] = useState(false);

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title="Delete Folder"
      icon={<AlertTriangle size={20} />}
      maxWidth="480px"
      footer={
        <>
          <button className="close-footer-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn--danger btn--md"
            onClick={() => {
              onConfirm(
                folder.id,
                deleteContents ? 'recursive' : 'move-to-parent'
              );
              onClose();
            }}
          >
            Delete Folder
          </button>
        </>
      }
    >
      <div className="delete-folder-modal">
        <p>
          Are you sure you want to delete the folder{' '}
          <strong>{folder.name}</strong>?
        </p>
        <label className="delete-folder-modal__option">
          <input
            type="checkbox"
            checked={deleteContents}
            onChange={(e) => setDeleteContents(e.target.checked)}
          />
          <span>
            Also delete everything inside (manifests and subfolders). Otherwise
            the contents move up one level.
          </span>
        </label>
        {deleteContents && (
          <p className="delete-folder-modal__warning">
            This permanently deletes all manifests in this folder and its
            subfolders. It cannot be undone.
          </p>
        )}
      </div>
    </BaseModal>
  );
}
