import { ToolMissingPanel } from '../../../components/common/ToolMissingPanel';
import { TOOL_INSTALL_URLS } from '../../../hooks/useToolStatus';

export const KOMPOSE_INSTALL_URL = TOOL_INSTALL_URLS.kompose as string;

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
    <ToolMissingPanel
      title="kompose not found"
      description={
        <p>
          The migration tool uses{' '}
          <button
            type="button"
            className="tool-missing__link"
            onClick={onOpenInstallDocs}
          >
            kompose
          </button>{' '}
          (a CNCF project) to convert compose files. Install it and make sure
          it is on your PATH.
        </p>
      }
      onOpenInstallDocs={onOpenInstallDocs}
      onRecheck={onRecheck}
    />
  );
}
