import { FileCode, Plus, Upload, FolderPlus, BookOpen } from 'lucide-react';

interface ManifestsHeaderProps {
  onNewFolder: () => void;
  onUpload: () => void;
  onExamples: () => void;
  onNewManifest: () => void;
}

/** Title and the four page actions of the manifest library. */
export function ManifestsHeader({
  onNewFolder,
  onUpload,
  onExamples,
  onNewManifest,
}: ManifestsHeaderProps) {
  return (
    <div className="page-header">
      <div className="header-title-container">
        <FileCode size={32} className="header-icon" />
        <div className="header-text">
          <h1>Manifest Manager</h1>
          <p>Develop, store, and deploy Kubernetes YAMLs with ease.</p>
        </div>
      </div>
      <div className="header-actions">
        <button
          className="btn btn--secondary btn--md upload-btn"
          onClick={onNewFolder}
        >
          <FolderPlus size={18} />
          <span>New Folder</span>
        </button>
        <button
          className="btn btn--secondary btn--md upload-btn"
          onClick={onUpload}
        >
          <Upload size={18} />
          <span>Upload YAML</span>
        </button>
        <button
          className="btn btn--secondary btn--md upload-btn"
          onClick={onExamples}
        >
          <BookOpen size={18} />
          <span>Examples</span>
        </button>
        <button
          className="btn btn--primary btn--md add-btn"
          onClick={onNewManifest}
        >
          <Plus size={18} />
          <span>New Manifest</span>
        </button>
      </div>
    </div>
  );
}
