/**
 * Tool Service
 *
 * Detects the CLI tools Shoal shells out to. Each tool gets the probe it
 * actually understands: `kubectl --version` is not a valid command, so a
 * generic `--version` check reported kubectl (and helm) as missing.
 */

import { safeExec, ALLOWED_TOOLS } from '../../utils/safe-exec';
import type { ToolStatus } from '../../types/tool-types';

const PROBE_TIMEOUT_MS = 10_000;

/** Version command per tool; tools not listed answer `<tool> version`. */
const VERSION_ARGS: Record<string, string[]> = {
  kubectl: ['version', '--client'],
  helm: ['version', '--short'],
  minikube: ['version', '--short'],
  docker: ['--version'],
  podman: ['--version'],
};

/** Container engines: a second probe tells whether the daemon is up. */
const DAEMON_ARGS: Record<string, string[]> = {
  docker: ['info', '--format', '{{.ServerVersion}}'],
  podman: ['info', '--format', '{{.Version.Version}}'],
};

function firstLine(output: string): string {
  return output.trim().split(/\r?\n/)[0]?.trim() ?? '';
}

export class ToolService {
  /** Probe a tool. Throws only for tools outside the safe-exec allowlist. */
  async getToolStatus(tool: string): Promise<ToolStatus> {
    if (!ALLOWED_TOOLS.has(tool)) {
      throw new Error(`Tool not allowed: "${tool}"`);
    }

    let version: string;
    try {
      const { stdout } = await safeExec(
        tool,
        VERSION_ARGS[tool] ?? ['version'],
        {
          timeout: PROBE_TIMEOUT_MS,
        }
      );
      version = firstLine(stdout);
    } catch {
      return { tool, installed: false };
    }

    const daemonArgs = DAEMON_ARGS[tool];
    if (!daemonArgs) return { tool, installed: true, version };

    try {
      await safeExec(tool, daemonArgs, { timeout: PROBE_TIMEOUT_MS });
      return { tool, installed: true, version, running: true };
    } catch {
      return { tool, installed: true, version, running: false };
    }
  }
}

export const toolService = new ToolService();
