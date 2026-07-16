import { AlertTriangle, Download, Loader2 } from 'lucide-react';
import { ManifestEditor } from './ManifestEditor';
import type { ComposeConversion } from '../../../types';

export interface MigrationReviewProps {
  composePath: string | null;
  conversion: ComposeConversion;
  currentContext: string | null;
  projectName: string;
  importing: boolean;
  onProjectNameChange: (value: string) => void;
  onUpdateManifest: (index: number, content: string) => void;
  onRemoveManifest: (index: number) => void;
  onImport: () => void;
  onReset: () => void;
}

function WarningsBox({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="migration-page__warnings">
      <p className="migration-page__warnings-title">
        <AlertTriangle size={14} />
        kompose warnings
      </p>
      <ul>
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}

function LocalImagesBox({ images }: { images: string[] }) {
  if (images.length === 0) return null;
  return (
    <div className="migration-page__warnings migration-page__warnings--images">
      <p className="migration-page__warnings-title">
        <AlertTriangle size={14} />
        Locally built images
      </p>
      <p className="migration-page__warnings-text">
        These images come from <code>build:</code> sections, so your cluster
        cannot pull them. Load them first (e.g.{' '}
        <code>kind load docker-image &lt;image&gt;</code> or{' '}
        <code>minikube image load &lt;image&gt;</code>) or push them to a
        registry:
      </p>
      <ul>
        {images.map((image) => (
          <li key={image}>
            <code>{image}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Review step: warnings, generated manifests, and the import form. */
export function MigrationReview({
  composePath,
  conversion,
  currentContext,
  projectName,
  importing,
  onProjectNameChange,
  onUpdateManifest,
  onRemoveManifest,
  onImport,
  onReset,
}: MigrationReviewProps) {
  return (
    <div className="migration-page__review">
      <div className="migration-page__review-summary">
        <p className="migration-page__review-source">
          Converted <code>{composePath}</code> into{' '}
          {conversion.manifests.length} Kubernetes resources.
        </p>
      </div>

      <WarningsBox warnings={conversion.warnings} />
      <LocalImagesBox images={conversion.locallyBuiltImages} />

      <div className="migration-page__manifest-list">
        {conversion.manifests.map((manifest, index) => (
          <ManifestEditor
            key={`${manifest.fileName}-${index}`}
            manifest={manifest}
            index={index}
            onChange={onUpdateManifest}
            onRemove={onRemoveManifest}
            canRemove={conversion.manifests.length > 1}
          />
        ))}
      </div>

      <div className="migration-page__import">
        <div className="migration-page__field">
          <label
            className="migration-page__label"
            htmlFor="migration-project-name"
          >
            Manifest folder name
          </label>
          <input
            id="migration-project-name"
            className="migration-page__input"
            value={projectName}
            onChange={(event) => onProjectNameChange(event.target.value)}
            placeholder="compose-migration"
            maxLength={100}
          />
        </div>
        <p className="migration-page__hint">
          Manifests are saved for context <code>{currentContext ?? '...'}</code>{' '}
          and can be applied from the Manifests page.
        </p>
        <div className="migration-page__actions">
          <button
            className="migration-page__secondary-btn"
            onClick={onReset}
            disabled={importing}
          >
            Start over
          </button>
          <button
            className="migration-page__primary-btn"
            onClick={onImport}
            disabled={importing || conversion.manifests.length === 0}
          >
            {importing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Import {conversion.manifests.length} manifests
          </button>
        </div>
      </div>
    </div>
  );
}
