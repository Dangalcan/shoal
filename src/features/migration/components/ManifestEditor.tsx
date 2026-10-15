import { useState } from 'react';
import { ChevronDown, ChevronRight, FileCode, Trash2 } from 'lucide-react';
import type { ConvertedManifest } from '../../../types';

export interface ManifestEditorProps {
  manifest: ConvertedManifest;
  index: number;
  onChange: (index: number, content: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

/** Collapsible, editable YAML block for one converted resource. */
export function ManifestEditor({
  manifest,
  index,
  onChange,
  onRemove,
  canRemove,
}: ManifestEditorProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="migration-page__manifest">
      <div className="migration-page__manifest-header">
        <button
          className="migration-page__manifest-toggle"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <FileCode size={14} />
          <span className="migration-page__manifest-name">
            {manifest.fileName}
          </span>
          <span className="migration-page__manifest-kind">{manifest.kind}</span>
        </button>
        {canRemove && (
          <button
            className="migration-page__manifest-remove"
            onClick={() => onRemove(index)}
            title="Exclude from import"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {expanded && (
        <textarea
          aria-label={`YAML of ${manifest.fileName}`}
          className="migration-page__manifest-content"
          value={manifest.content}
          onChange={(event) => onChange(index, event.target.value)}
          spellCheck={false}
          rows={Math.min(24, manifest.content.split('\n').length + 1)}
        />
      )}
    </div>
  );
}
