import { useState } from 'react';
import { FolderPlus, Pencil } from 'lucide-react';
import { BaseModal } from '../../components/modals/BaseModal';

/**
 * Rendered only while open (the parent mounts it conditionally), so the
 * input state initializes fresh on every open.
 */
interface FolderNameModalProps {
  onClose: () => void;
  /** Existing name when renaming; empty for creation. */
  initialName?: string;
  onSubmit: (name: string) => void;
}

export function FolderNameModal({
  onClose,
  initialName = '',
  onSubmit,
}: FolderNameModalProps) {
  const [name, setName] = useState(initialName);
  const isRename = initialName !== '';

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  };

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title={isRename ? 'Rename Folder' : 'New Folder'}
      icon={isRename ? <Pencil size={20} /> : <FolderPlus size={20} />}
      maxWidth="440px"
      footer={
        <>
          <button className="close-footer-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn--primary btn--md"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            {isRename ? 'Rename' : 'Create'}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label htmlFor="folder-name">Folder Name</label>
        <input
          id="folder-name"
          type="text"
          value={name}
          autoFocus
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          placeholder="e.g., Production Deployments"
        />
      </div>
    </BaseModal>
  );
}
