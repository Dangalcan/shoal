import { useRef } from 'react';
import { ConfirmModal } from '../components/modals/ConfirmModal';
import { FolderBreadcrumbs } from '../features/manifests/FolderBreadcrumbs';
import { ExampleTemplatesModal } from '../features/manifests/ExampleTemplatesModal';
import { ManifestEditorModal } from '../features/manifests/ManifestEditorModal';
import { ManifestFolderDialogs } from '../features/manifests/ManifestFolderDialogs';
import { ManifestsHeader } from '../features/manifests/ManifestsHeader';
import { ManifestsGrid } from '../features/manifests/ManifestsGrid';
import { useManifestsPage } from '../features/manifests/useManifestsPage';

export function Manifests() {
  const page = useManifestsPage();
  const { folders, folderDialogs, editor, importer, actions } = page;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openPicker = () => fileInputRef.current?.click();

  return (
    <div className="manifests-page">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".yaml,.yml"
        multiple
        onChange={importer.handleFileUpload}
      />
      <ManifestsHeader
        onNewFolder={folderDialogs.createFolder}
        onUpload={openPicker}
        onExamples={() => page.setIsExamplesOpen(true)}
        onNewManifest={editor.create}
      />

      <FolderBreadcrumbs
        breadcrumbs={folders.breadcrumbs}
        onNavigate={folders.openFolder}
        onDropManifest={folders.moveManifestToFolder}
        onDropFolder={folders.moveFolder}
      />

      <ManifestEditorModal editor={editor} />

      <ConfirmModal
        isOpen={!!actions.deletion.pendingId}
        onClose={actions.deletion.cancel}
        onConfirm={actions.deletion.confirm}
        title="Delete Manifest"
        message="Are you sure you want to delete this manifest? This action cannot be undone."
        confirmLabel="Delete Manifest"
        variant="danger"
      />

      {page.isExamplesOpen && (
        <ExampleTemplatesModal
          onClose={() => page.setIsExamplesOpen(false)}
          onSelect={editor.useTemplate}
        />
      )}

      <ManifestFolderDialogs folders={folders} dialogs={folderDialogs} />

      <ManifestsGrid
        childFolders={folders.childFolders}
        folderItemCounts={page.folderItemCounts}
        manifests={page.visibleManifests}
        loading={page.loading && page.manifests.length === 0}
        error={page.loadError}
        onRetry={page.retryLoad}
        isEmpty={page.isEmpty}
        currentFolderId={folders.currentFolderId}
        importer={importer}
        onUploadClick={openPicker}
        applying={actions.applying}
        onApply={actions.apply}
        onEdit={editor.edit}
        onMoveManifest={folderDialogs.moveManifest}
        onDeleteManifest={actions.deletion.request}
        onOpenFolder={folders.openFolder}
        onRenameFolder={folderDialogs.renameFolder}
        onMoveFolder={folderDialogs.moveFolder}
        onDeleteFolder={folderDialogs.requestDeleteFolder}
        onDropManifest={folders.moveManifestToFolder}
        onDropFolder={folders.moveFolder}
      />
    </div>
  );
}

export default Manifests;
