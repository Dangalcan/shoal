import { useApi } from '../services/api-context';
import { useAsyncData } from './useAsyncData';
import type { ToolStatus } from '../types.d';

/** Official install guides for the CLI tools Shoal detects. */
export const TOOL_INSTALL_URLS: Record<string, string> = {
  kubectl: 'https://kubernetes.io/docs/tasks/tools/',
  helm: 'https://helm.sh/docs/intro/install/',
  kind: 'https://kind.sigs.k8s.io/docs/user/quick-start/#installation',
  k3d: 'https://k3d.io/stable/#installation',
  docker: 'https://docs.docker.com/get-started/get-docker/',
  podman: 'https://podman.io/docs/installation',
  kompose: 'https://kompose.io/installation/',
};

export interface UseToolStatusResult {
  /** null while the first probe is running. */
  status: ToolStatus | null;
  checking: boolean;
  recheck: () => Promise<void>;
  /** True once a probe finished and the tool is not installed. */
  missing: boolean;
}

/** Probes a CLI tool through the main process (`get-tool-status`). */
export function useToolStatus(tool: string): UseToolStatusResult {
  const api = useApi();
  const { data, loading, refetch } = useAsyncData<ToolStatus>({
    fetchFn: () => api.getToolStatus(tool),
    errorTitle: `Failed to check ${tool}`,
    dependencies: [tool],
  });
  return {
    status: data,
    checking: loading,
    recheck: refetch,
    missing: !loading && data !== null && !data.installed,
  };
}
