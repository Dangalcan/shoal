/**
 * Safe Exec
 *
 * The ONLY sanctioned way to run external tools from the main process.
 * Uses `execFile` (no shell), so arguments are passed as an array and
 * shell metacharacters in user input are never interpreted.
 *
 * Every tool must be on the allowlist. Do not add generic shells
 * (sh, bash, cmd, powershell) to this list.
 */

import { execFile } from 'child_process';
import util from 'util';

const execFileAsync = util.promisify(execFile);

/** External tools the app is allowed to invoke. */
export const ALLOWED_TOOLS = new Set([
  'kubectl',
  'helm',
  'kind',
  'minikube',
  'k3d',
  'k9s',
  'kubectx',
  'kubens',
  'docker',
  'podman',
  'kompose',
]);

export interface SafeExecOptions {
  /** Max buffer for stdout/stderr in bytes. Defaults to 10 MiB. */
  maxBuffer?: number;
  /** Timeout in milliseconds. Defaults to no timeout. */
  timeout?: number;
}

const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

/**
 * Run an allowlisted tool with an argument array. No shell is involved:
 * arguments are handed to the OS verbatim, so injection via metacharacters
 * (";", "|", "$()", backticks…) is not possible.
 *
 * @throws if the tool is not allowlisted or the process fails.
 */
export async function safeExec(
  tool: string,
  args: string[],
  options: SafeExecOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  if (!ALLOWED_TOOLS.has(tool)) {
    throw new Error(
      `Tool not allowed: "${tool}". Permitted tools: ${[...ALLOWED_TOOLS].join(', ')}`
    );
  }

  for (const arg of args) {
    if (typeof arg !== 'string') {
      throw new Error(`Invalid argument for ${tool}: expected string`);
    }
  }

  try {
    const { stdout, stderr } = await execFileAsync(tool, args, {
      maxBuffer: options.maxBuffer ?? DEFAULT_MAX_BUFFER,
      timeout: options.timeout,
      windowsHide: true,
      // On Windows, kubectl/kind/etc. resolve via PATH; execFile handles
      // .exe directly. shell stays OFF — that is the whole point.
      shell: false,
    });
    return { stdout, stderr };
  } catch (err: unknown) {
    throw describeExecError(tool, err);
  }
}

/**
 * Turns execFile's error into one a user can read in a toast: a missing
 * binary says so instead of "spawn kubectl ENOENT", and a failed command
 * keeps the tool's own message (first line of stderr) instead of the full
 * command line followed by the whole stderr.
 */
export function describeExecError(tool: string, err: unknown): Error {
  const e = err as {
    code?: unknown;
    stderr?: unknown;
    message?: unknown;
    killed?: boolean;
    signal?: string;
  };
  if (e?.code === 'ENOENT') {
    return new Error(`${tool} is not installed or not on the PATH`);
  }
  if (e?.killed && e.signal === 'SIGTERM') {
    return new Error(`${tool} did not answer in time`);
  }
  const stderr = typeof e?.stderr === 'string' ? e.stderr.trim() : '';
  const firstLine = stderr.split(/\r?\n/)[0] ?? '';
  if (firstLine) return new Error(`${tool}: ${firstLine}`);
  return err instanceof Error ? err : new Error(String(err));
}
