import { useState } from 'react';
import { toast } from 'sonner';
import { useApi } from '../../services/api-context';

export interface ManifestDeletion {
  /** Id of the manifest awaiting confirmation; null when none. */
  pendingId: number | null;
  request: (id: number) => void;
  cancel: () => void;
  confirm: () => Promise<void>;
}

export interface UseManifestActionsResult {
  /** Id of the manifest being applied; null when none. */
  applying: number | null;
  apply: (id: number) => Promise<void>;
  deletion: ManifestDeletion;
}

/** Applying a stored manifest to the cluster and deleting one after confirmation. */
export function useManifestActions(
  onDeleted: () => void | Promise<void>
): UseManifestActionsResult {
  const api = useApi();
  const [applying, setApplying] = useState<number | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const apply = async (id: number) => {
    setApplying(id);
    const result = await api.applyManifest(id);
    if (result.success) {
      toast.success('Manifest applied successfully!');
    } else {
      toast.error(`Error applying manifest: ${result.error}`);
    }
    setApplying(null);
  };

  const confirm = async () => {
    if (!pendingId) return;
    const id = pendingId;
    setPendingId(null);
    const result = await api.deleteManifest(id);
    if (result.success) {
      toast.success('Manifest deleted successfully');
      await onDeleted();
    } else {
      toast.error('Failed to delete manifest', { description: result.error });
    }
  };

  return {
    applying,
    apply,
    deletion: {
      pendingId,
      request: setPendingId,
      cancel: () => setPendingId(null),
      confirm,
    },
  };
}
