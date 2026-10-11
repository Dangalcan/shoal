import { Play, Edit2, FolderInput, Trash2 } from 'lucide-react';
import type { Manifest } from '../../types.d';
import { MANIFEST_DRAG_TYPE, setDragPayload } from './manifest-dnd';
import { parseSqliteTimestamp } from '../../lib/utils';

interface ManifestCardProps {
  manifest: Manifest;
  applying: number | null;
  onApply: (id: number) => void;
  onEdit: (manifest: Manifest) => void;
  onMove?: (manifest: Manifest) => void;
  onDelete: (id: number) => void;
}

export function ManifestCard({
  manifest: m,
  applying,
  onApply,
  onEdit,
  onMove,
  onDelete,
}: ManifestCardProps) {
  return (
    <div
      className="manifest-card"
      draggable
      onDragStart={(e) => setDragPayload(e, MANIFEST_DRAG_TYPE, m.id)}
    >
      <div className="card-header">
        <h3 title={m.name}>{m.name}</h3>
        <div className="card-actions">
          <button
            className="btn-icon btn-apply"
            title="Apply to Cluster"
            onClick={() => onApply(m.id)}
            disabled={applying === m.id}
          >
            {applying === m.id ? (
              <div className="spinner-small" />
            ) : (
              <Play size={16} />
            )}
          </button>
          <button
            className="btn-icon btn-edit"
            title="Edit Manifest"
            onClick={() => onEdit(m)}
          >
            <Edit2 size={16} />
          </button>
          {onMove && (
            <button
              className="btn-icon btn-move"
              title="Move to Folder"
              onClick={() => onMove(m)}
            >
              <FolderInput size={16} />
            </button>
          )}
          <button
            className="btn-icon btn-delete"
            title="Delete"
            onClick={() => onDelete(m.id)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="card-body">
        <div className="manifest-info">
          <span>Context: {m.cluster_context}</span>
          <span>
            Updated: {parseSqliteTimestamp(m.updated_at).toLocaleDateString()}
          </span>
        </div>
        <pre className="yaml-preview">
          {m.content.substring(0, 150)}
          {m.content.length > 150 ? '...' : ''}
        </pre>
      </div>
    </div>
  );
}
