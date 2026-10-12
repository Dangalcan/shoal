/**
 * Windows PATH refresh.
 *
 * process.env.PATH is a snapshot taken when Shoal started. Installers
 * (winget, Chocolatey, Docker Desktop) add their folder to the user or
 * system PATH in the registry and broadcast the change, but a running
 * process never sees it, so "Check again" kept saying a tool was missing
 * until Shoal was restarted. Before probing a tool on Windows we re-read
 * both registry values and append any new folder to process.env.PATH.
 *
 * reg.exe is run by absolute path with fixed arguments and no shell. It is
 * deliberately not in the safe-exec allowlist: that list gates tool names
 * that arrive over IPC, and reg can also write the registry.
 */

import { execFile } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { promisify } from 'util';
import { augmentPath } from './path-env';
import log from '../logger';

const execFileAsync = promisify(execFile);

/** One registry read serves all the probes a "Check again" click fires. */
const MIN_INTERVAL_MS = 5_000;

const REG_QUERIES: ReadonlyArray<readonly string[]> = [
  ['query', 'HKCU\\Environment', '/v', 'Path'],
  [
    'query',
    'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment',
    '/v',
    'Path',
  ],
];

const PATH_LINE = /^\s*Path\s+REG_(?:EXPAND_)?SZ\s+(.*)$/im;

/** The `Path` value from `reg query` output, or null when it is absent. */
export function parseRegPathOutput(stdout: string): string | null {
  const match = PATH_LINE.exec(stdout);
  const value = match?.[1]?.trim();
  return value ? value : null;
}

/**
 * Expands `%NAME%` references (case-insensitive, like Windows). Unknown
 * names are left as they are; mergeWindowsPath drops such entries.
 */
export function expandWindowsEnv(
  value: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const lookup = new Map<string, string>();
  for (const [key, val] of Object.entries(env)) {
    if (val !== undefined) lookup.set(key.toLowerCase(), val);
  }
  return value.replace(/%([^%]+)%/g, (whole, name: string) => {
    const found = lookup.get(name.toLowerCase());
    return found === undefined ? whole : found;
  });
}

const normalize = (dir: string) => dir.replace(/[\\/]+$/, '').toLowerCase();

/**
 * Appends the registry PATH folders that are new, exist and are fully
 * expanded to `current`. Existing entries keep their order and priority.
 */
export function mergeWindowsPath(
  current: string,
  registryValues: string[],
  env: NodeJS.ProcessEnv = process.env,
  exists: (dir: string) => boolean = existsSync
): string {
  const known = new Set(current.split(';').filter(Boolean).map(normalize));
  const candidates: string[] = [];
  for (const value of registryValues) {
    for (const raw of expandWindowsEnv(value, env).split(';')) {
      const dir = raw.trim();
      if (!dir || dir.includes('%') || known.has(normalize(dir))) continue;
      known.add(normalize(dir));
      candidates.push(dir);
    }
  }
  return augmentPath(current, candidates, exists, ';');
}

let lastRefresh = 0;
let inFlight: Promise<void> | null = null;

/** Lets tests start from a clean throttle. */
export function _resetWindowsPathThrottle(): void {
  lastRefresh = 0;
  inFlight = null;
}

async function readRegistryPaths(): Promise<string[]> {
  const reg = path.win32.join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'System32',
    'reg.exe'
  );
  const results = await Promise.allSettled(
    REG_QUERIES.map((args) =>
      execFileAsync(reg, [...args], {
        shell: false,
        windowsHide: true,
        timeout: 3_000,
        maxBuffer: 1024 * 1024,
      })
    )
  );
  const values: string[] = [];
  for (const result of results) {
    if (result.status !== 'fulfilled') {
      log.warn('[WindowsPath] reg query failed:', String(result.reason));
      continue;
    }
    const value = parseRegPathOutput(result.value.stdout);
    if (value) values.push(value);
  }
  return values;
}

/**
 * Re-reads the user and machine PATH from the registry and appends new
 * folders to process.env.PATH. Does nothing off Windows, at most once per
 * MIN_INTERVAL_MS, shares one read between concurrent callers, and never
 * throws: a failure only means the probe runs with the PATH it already had.
 */
export function refreshWindowsPath(
  now: () => number = Date.now
): Promise<void> {
  if (process.platform !== 'win32') return Promise.resolve();
  if (inFlight) return inFlight;
  if (now() - lastRefresh < MIN_INTERVAL_MS) return Promise.resolve();

  inFlight = (async () => {
    try {
      const values = await readRegistryPaths();
      if (values.length === 0) return;
      const before = process.env.PATH ?? '';
      const after = mergeWindowsPath(before, values);
      if (after !== before) {
        process.env.PATH = after;
        const added = after.slice(before.length).split(';').filter(Boolean);
        log.info('[WindowsPath] PATH gained:', added.join(';'));
      }
    } catch (err: unknown) {
      log.warn('[WindowsPath] PATH refresh failed:', String(err));
    } finally {
      lastRefresh = now();
      inFlight = null;
    }
  })();
  return inFlight;
}
