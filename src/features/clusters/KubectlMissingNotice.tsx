import { ToolMissingPanel } from '../../components/common/ToolMissingPanel';
import { useToolStatus, TOOL_INSTALL_URLS } from '../../hooks/useToolStatus';
import { useApi } from '../../services/api-context';

export interface KubectlMissingNoticeProps {
  /** Called after "Check again" (e.g. to reload the cluster list). */
  onRecheck?: () => void | Promise<void>;
}

/**
 * Explains that kubectl is missing instead of letting every cluster call fail
 * with a raw spawn error. Renders nothing while probing or when installed.
 */
export function KubectlMissingNotice({ onRecheck }: KubectlMissingNoticeProps) {
  const api = useApi();
  const kubectl = useToolStatus('kubectl');

  if (!kubectl.missing) return null;

  return (
    <ToolMissingPanel
      title="kubectl not found"
      description={
        <p>
          Shoal talks to your clusters through <code>kubectl</code>. Install it
          and make sure it is on your PATH, then check again.
        </p>
      }
      onOpenInstallDocs={() =>
        api.openExternal(TOOL_INSTALL_URLS.kubectl as string)
      }
      onRecheck={async () => {
        await kubectl.recheck();
        await onRecheck?.();
      }}
    />
  );
}
