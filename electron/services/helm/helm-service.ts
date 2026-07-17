/**
 * Helm Service
 *
 * The sanctioned way to run Helm operations from the main process. Every
 * value that becomes a CLI argument is validated here (argument-injection
 * defense: nothing may start with "-"), and execution goes through
 * safe-exec (execFile, no shell).
 *
 * Custom values are never passed via --set: they are written to a private
 * temp file and handed to Helm with -f, so value content is parsed as YAML
 * by Helm and never interpreted as arguments.
 */

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { safeExec } from '../../utils/safe-exec';
import { assertContext, assertNamespace } from '../../utils/k8s-validate';
import { resourceReadCache } from '../kubernetes/resource-read-cache';

/** Helm release names: RFC 1123 label (helm enforces <=53 chars). */
const RELEASE_NAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
/** Chart references: "repo/chart", bare "chart", or "oci://host/path". */
const CHART_REF_RE = /^(oci:\/\/)?[a-zA-Z0-9][a-zA-Z0-9._\-/]*$/;
/** Chart versions: semver-ish, optional leading v. */
const CHART_VERSION_RE = /^v?[0-9][0-9a-zA-Z.+-]*$/;
/** Helm repo names: RFC 1123 label. */
const REPO_NAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

const MAX_VALUES_BYTES = 1024 * 1024; // 1 MiB of custom values is plenty
const MUTATE_TIMEOUT_MS = 5 * 60 * 1000;
const QUERY_TIMEOUT_MS = 60 * 1000;

export function assertReleaseName(v: string): void {
  if (!v || v.length > 53 || !RELEASE_NAME_RE.test(v)) {
    throw new Error(`Invalid release name: "${v}"`);
  }
}

export function assertChartRef(v: string): void {
  if (!v || v.length > 512 || !CHART_REF_RE.test(v)) {
    throw new Error(`Invalid chart reference: "${v}"`);
  }
}

export function assertChartVersion(v: string): void {
  if (!v || !CHART_VERSION_RE.test(v)) {
    throw new Error(`Invalid chart version: "${v}"`);
  }
}

export function assertRevision(v: number): void {
  if (!Number.isInteger(v) || v < 1) {
    throw new Error(`Invalid revision: "${v}"`);
  }
}

export function assertRepoName(v: string): void {
  if (!v || v.length > 64 || !REPO_NAME_RE.test(v)) {
    throw new Error(`Invalid repository name: "${v}"`);
  }
}

export function assertRepoUrl(v: string): void {
  let parsed: URL;
  try {
    parsed = new URL(v);
  } catch {
    throw new Error(`Invalid repository URL: "${v}"`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Repository URL must be http(s): "${v}"`);
  }
}

export interface HelmReleaseArgs {
  contextName: string;
  namespace: string;
  releaseName: string;
}

export interface HelmInstallArgs extends HelmReleaseArgs {
  chart: string;
  version?: string;
  /** Raw YAML custom values (applied via a temp -f file). */
  values?: string;
  createNamespace?: boolean;
}

export interface HelmRollbackArgs extends HelmReleaseArgs {
  revision: number;
}

export interface HelmRepoAddArgs {
  name: string;
  url: string;
}

function assertReleaseArgs(args: HelmReleaseArgs): void {
  assertContext(args.contextName);
  assertNamespace(args.namespace);
  if (args.namespace === 'all') {
    throw new Error('A concrete namespace is required for Helm operations');
  }
  assertReleaseName(args.releaseName);
}

/**
 * Write custom values to a private temp file and return the extra -f args.
 * The caller must invoke the returned cleanup function in a finally block.
 */
async function stageValuesFile(
  values: string | undefined
): Promise<{ args: string[]; cleanup: () => Promise<void> }> {
  if (values === undefined || values.trim() === '') {
    return { args: [], cleanup: async () => {} };
  }
  if (typeof values !== 'string' || values.length > MAX_VALUES_BYTES) {
    throw new Error('Invalid values: expected a YAML string under 1 MiB');
  }
  const file = path.join(
    os.tmpdir(),
    `k8s-desktop-helm-values-${crypto.randomBytes(8).toString('hex')}.yaml`
  );
  await fs.writeFile(file, values, { encoding: 'utf8', mode: 0o600 });
  return {
    args: ['-f', file],
    cleanup: async () => {
      try {
        await fs.unlink(file);
      } catch {
        // best effort: temp dir is cleaned by the OS eventually
      }
    },
  };
}

async function runReleaseMutation(
  verbArgs: string[],
  args: HelmInstallArgs
): Promise<string> {
  assertReleaseArgs(args);
  assertChartRef(args.chart);
  if (args.version !== undefined) assertChartVersion(args.version);

  const staged = await stageValuesFile(args.values);
  try {
    const cli = [
      ...verbArgs,
      args.releaseName,
      args.chart,
      '--kube-context',
      args.contextName,
      '-n',
      args.namespace,
      ...(args.version ? ['--version', args.version] : []),
      ...(args.createNamespace ? ['--create-namespace'] : []),
      ...staged.args,
    ];
    const { stdout } = await safeExec('helm', cli, {
      timeout: MUTATE_TIMEOUT_MS,
    });
    // Helm changed cluster state (incl. release secrets) — drop cached reads
    resourceReadCache.clear();
    return stdout;
  } finally {
    await staged.cleanup();
  }
}

export class HelmService {
  async install(args: HelmInstallArgs): Promise<string> {
    return runReleaseMutation(['install'], args);
  }

  async upgrade(args: HelmInstallArgs): Promise<string> {
    return runReleaseMutation(['upgrade'], args);
  }

  async rollback(args: HelmRollbackArgs): Promise<string> {
    assertReleaseArgs(args);
    assertRevision(args.revision);
    const { stdout } = await safeExec(
      'helm',
      [
        'rollback',
        args.releaseName,
        String(args.revision),
        '--kube-context',
        args.contextName,
        '-n',
        args.namespace,
      ],
      { timeout: MUTATE_TIMEOUT_MS }
    );
    resourceReadCache.clear();
    return stdout;
  }

  async uninstall(args: HelmReleaseArgs): Promise<string> {
    assertReleaseArgs(args);
    const { stdout } = await safeExec(
      'helm',
      [
        'uninstall',
        args.releaseName,
        '--kube-context',
        args.contextName,
        '-n',
        args.namespace,
      ],
      { timeout: MUTATE_TIMEOUT_MS }
    );
    resourceReadCache.clear();
    return stdout;
  }

  async repoAdd(args: HelmRepoAddArgs): Promise<string> {
    assertRepoName(args.name);
    assertRepoUrl(args.url);
    const { stdout } = await safeExec(
      'helm',
      ['repo', 'add', args.name, args.url, '--force-update'],
      { timeout: QUERY_TIMEOUT_MS }
    );
    await safeExec('helm', ['repo', 'update', args.name], {
      timeout: QUERY_TIMEOUT_MS,
    });
    return stdout;
  }

  async repoList(): Promise<Array<{ name: string; url: string }>> {
    try {
      const { stdout } = await safeExec(
        'helm',
        ['repo', 'list', '-o', 'json'],
        {
          timeout: QUERY_TIMEOUT_MS,
        }
      );
      const parsed = JSON.parse(stdout);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      // "no repositories to show" exits non-zero — treat as empty, not error
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('no repositories')) return [];
      throw err;
    }
  }
}

export const helmService = new HelmService();
