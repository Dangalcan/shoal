import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Container, FileUp, Loader2 } from 'lucide-react';
import { useApi } from '../services/api-context';
import { useMigration } from '../features/migration/useMigration';
import {
  KomposeMissingPanel,
  KOMPOSE_INSTALL_URL,
} from '../features/migration/components/KomposeMissingPanel';
import { MigrationReview } from '../features/migration/components/MigrationReview';

function SelectStep({
  converting,
  onSelect,
}: {
  converting: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="migration-page__select">
      <FileUp size={48} className="migration-page__select-icon" />
      <p className="migration-page__select-title">
        Convert a docker-compose file to Kubernetes manifests
      </p>
      <p className="migration-page__select-subtitle">
        Pick a <code>docker-compose.yml</code> and kompose will generate
        Deployments, Services and PersistentVolumeClaims you can review before
        importing.
      </p>
      <button
        className="migration-page__primary-btn"
        onClick={onSelect}
        disabled={converting}
      >
        {converting ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <FileUp size={14} />
        )}
        {converting ? 'Converting...' : 'Select compose file'}
      </button>
    </div>
  );
}

function DoneStep({
  onReset,
  onOpenManifests,
}: {
  onReset: () => void;
  onOpenManifests: () => void;
}) {
  return (
    <div className="migration-page__done">
      <CheckCircle2 size={48} className="migration-page__done-icon" />
      <p className="migration-page__done-title">Migration imported</p>
      <p className="migration-page__done-subtitle">
        Review and apply the manifests from the Manifests page whenever you are
        ready.
      </p>
      <div className="migration-page__actions">
        <button className="migration-page__secondary-btn" onClick={onReset}>
          Migrate another project
        </button>
        <button
          className="migration-page__primary-btn"
          onClick={onOpenManifests}
        >
          Open Manifests
        </button>
      </div>
    </div>
  );
}

export function Migration() {
  const api = useApi();
  const navigate = useNavigate();
  const migration = useMigration();
  const [projectName, setProjectName] = useState('');

  const { komposeStatus, checkingKompose, step, conversion } = migration;
  const komposeMissing =
    !checkingKompose && komposeStatus !== null && !komposeStatus.available;
  const komposeReady = !checkingKompose && komposeStatus?.available === true;

  return (
    <div className="migration-page">
      <div className="migration-page__header">
        <div className="migration-page__title">
          <Container size={18} color="var(--color-primary)" />
          <span className="migration-page__title-text">
            Migrate from Docker Compose
          </span>
        </div>
      </div>

      <div className="migration-page__body">
        {checkingKompose && (
          <div className="migration-page__status">
            <Loader2 size={20} className="animate-spin" />
            <span>Checking for kompose...</span>
          </div>
        )}

        {komposeMissing && (
          <KomposeMissingPanel
            onOpenInstallDocs={() => api.openExternal(KOMPOSE_INSTALL_URL)}
            onRecheck={migration.recheckKompose}
          />
        )}

        {komposeReady && step === 'select' && (
          <SelectStep
            converting={migration.converting}
            onSelect={migration.selectAndConvert}
          />
        )}

        {step === 'review' && conversion && (
          <MigrationReview
            composePath={migration.composePath}
            conversion={conversion}
            currentContext={migration.currentContext}
            projectName={projectName}
            importing={migration.importing}
            onProjectNameChange={setProjectName}
            onUpdateManifest={migration.updateManifest}
            onRemoveManifest={migration.removeManifest}
            onImport={() =>
              migration.importManifests(
                projectName.trim() || 'compose-migration'
              )
            }
            onReset={migration.reset}
          />
        )}

        {step === 'done' && (
          <DoneStep
            onReset={migration.reset}
            onOpenManifests={() => navigate('/manifests')}
          />
        )}
      </div>
    </div>
  );
}
