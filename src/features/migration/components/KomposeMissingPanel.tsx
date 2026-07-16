import { AlertTriangle, Download, RefreshCw } from 'lucide-react';

export const KOMPOSE_INSTALL_URL = 'https://kompose.io/installation/';

export interface KomposeMissingPanelProps {
  onOpenInstallDocs: () => void;
  onRecheck: () => void;
}

/** Shown when the kompose binary is not on PATH. */
export function KomposeMissingPanel({
  onOpenInstallDocs,
  onRecheck,
}: KomposeMissingPanelProps) {
  return (
    <div className="migration-page__missing">
      <AlertTriangle size={40} className="migration-page__missing-icon" />
      <p className="migration-page__missing-title">kompose not found</p>
      <p className="migration-page__missing-subtitle">
        The migration tool uses{' '}
        <button className="migration-page__link" onClick={onOpenInstallDocs}>
          kompose
        </button>{' '}
        (a CNCF project) to convert compose files. Install it and make sure it
        is on your PATH.
      </p>
      <div className="migration-page__missing-actions">
        <button
          className="migration-page__secondary-btn"
          onClick={onOpenInstallDocs}
        >
          <Download size={14} />
          Install instructions
        </button>
        <button className="migration-page__primary-btn" onClick={onRecheck}>
          <RefreshCw size={14} />
          Check again
        </button>
      </div>
    </div>
  );
}
