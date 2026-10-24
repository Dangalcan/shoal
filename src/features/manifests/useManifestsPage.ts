import { useState, useEffect, useMemo } from 'react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useApi } from '../../services/api-context';
import { handleError } from '../../lib/error-handler';
import type { Manifest } from '../../types.d';
import { useManifestFolders } from './useManifestFolders';
import { useManifestEditor } from './useManifestEditor';
import { useManifestImport } from './useManifestImport';
import { useManifestActions } from './useManifestActions';
import { useManifestFolderDialogs } from './useManifestFolderDialogs';

/**
 * The manifest library page: the manifests of the current folder, the
 * folder tree and its dialogs, the editor, file import, apply and delete.
 */
export function useManifestsPage() {
  const api = useApi();
  const {
    data: manifestsData,
    loading,
    refetch: fetchManifests,
  } = useAsyncData<Manifest[]>({
    fetchFn: async () => {
      const result = await api.getManifests();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch manifests');
      }
      return result.data ?? [];
    },
    errorTitle: 'Failed to fetch manifests',
  });
  const manifests = useMemo(() => manifestsData ?? [], [manifestsData]);

  const folders = useManifestFolders({ onManifestsChanged: fetchManifests });
  const { currentFolderId } = folders;
  const folderDialogs = useManifestFolderDialogs(folders);

  // New manifests are stored under the active context.
  const [activeContext, setActiveContext] = useState<string>('');
  useEffect(() => {
    const fetchContext = async () => {
      const result = await api.getCurrentContext();
      if (result.success && result.data) {
        setActiveContext(result.data);
      }
    };
    fetchContext().catch((err) =>
      handleError(err, 'Failed to read the current context')
    );
  }, [api]);

  const editor = useManifestEditor({
    save: (editingId, form) =>
      api.saveManifest({
        id: editingId || undefined,
        name: form.name,
        content: form.content,
        cluster_context: activeContext || 'default',
        // Only new manifests land in the current folder; edits keep their location.
        ...(editingId ? {} : { folder_id: currentFolderId }),
      }),
    onSaved: fetchManifests,
  });

  const importer = useManifestImport({
    saveImported: ({ name, content }) =>
      api.saveManifest({
        name,
        content,
        cluster_context: activeContext || 'default',
        folder_id: currentFolderId,
      }),
    onImported: fetchManifests,
  });

  const actions = useManifestActions(fetchManifests);
  const [isExamplesOpen, setIsExamplesOpen] = useState(false);

  const visibleManifests = useMemo(
    () => manifests.filter((m) => (m.folder_id ?? null) === currentFolderId),
    [manifests, currentFolderId]
  );

  const folderItemCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const m of manifests) {
      if (m.folder_id != null) {
        counts.set(m.folder_id, (counts.get(m.folder_id) ?? 0) + 1);
      }
    }
    for (const f of folders.folders) {
      if (f.parent_id != null) {
        counts.set(f.parent_id, (counts.get(f.parent_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [manifests, folders.folders]);

  return {
    manifests,
    loading,
    visibleManifests,
    folderItemCounts,
    isEmpty: visibleManifests.length === 0 && folders.childFolders.length === 0,
    folders,
    folderDialogs,
    editor,
    importer,
    actions,
    isExamplesOpen,
    setIsExamplesOpen,
  };
}
