import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Throwaway kubeconfig files for specs that must not read or change the
 * kubeconfig of the machine running them.
 */

export interface KubeconfigFile {
  /** Temporary folder holding the file; remove it when the spec ends. */
  dir: string;
  /** The kubeconfig itself, for KUBECONFIG or the Settings page. */
  file: string;
}

export function writeKubeconfig(name: string, content: string): KubeconfigFile {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `shoal-${name}-`));
  const file = path.join(dir, 'config');
  fs.writeFileSync(file, content);
  return { dir, file };
}

export const EMPTY_KUBECONFIG = [
  'apiVersion: v1',
  'kind: Config',
  'clusters: []',
  'contexts: []',
  'users: []',
  'current-context: ""',
  '',
].join('\n');

/**
 * A kubeconfig with one context whose API server never answers.
 *
 * `server` defaults to TEST-NET-3 (RFC 5737), which is never routed: the
 * connection either hangs until a timeout or fails at once, depending on the
 * network. `currentContext` false leaves the context listed but not selected,
 * so nothing tries to reach it until a test asks.
 */
export function unreachableKubeconfig(
  context: string,
  {
    server = 'https://203.0.113.1:6443',
    currentContext = true,
  }: { server?: string; currentContext?: boolean } = {}
): string {
  return [
    'apiVersion: v1',
    'kind: Config',
    'clusters:',
    '  - name: nowhere',
    '    cluster:',
    `      server: ${server}`,
    '      insecure-skip-tls-verify: true',
    'contexts:',
    `  - name: ${context}`,
    '    context:',
    '      cluster: nowhere',
    '      user: nobody',
    'users:',
    '  - name: nobody',
    '    user:',
    '      token: not-a-real-token',
    `current-context: ${currentContext ? context : '""'}`,
    '',
  ].join('\n');
}
