/**
 * App Settings
 *
 * Small JSON store in userData for settings the main process must apply
 * before any IPC call runs. Today: the kubeconfig path, which every kubectl
 * child process reads from process.env.KUBECONFIG.
 */

import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import type { Rectangle } from 'electron';
import log from '../../logger';
import { getErrorMessage } from '../../utils/error-utils';

export interface AppSettings {
  /** Value for KUBECONFIG (one path, or several joined by path.delimiter). */
  kubeconfigPath?: string;
  /** Main window bounds in its normal state; restored while still on a display. */
  windowBounds?: Rectangle;
  windowMaximized?: boolean;
}

export class AppSettingsStore {
  private settings: AppSettings = {};

  private get filePath(): string {
    return path.join(app.getPath('userData'), 'app-settings.json');
  }

  /** Loads the file; a missing or unreadable file means default settings. */
  async load(): Promise<AppSettings> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      this.settings =
        parsed && typeof parsed === 'object' ? (parsed as AppSettings) : {};
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        log.warn(
          '[AppSettings] Ignoring unreadable settings file:',
          getErrorMessage(error)
        );
      }
      this.settings = {};
    }
    return { ...this.settings };
  }

  get(): AppSettings {
    return { ...this.settings };
  }

  async update(patch: AppSettings): Promise<void> {
    const next: AppSettings = { ...this.settings, ...patch };
    for (const key of Object.keys(next) as (keyof AppSettings)[]) {
      if (next[key] === undefined) delete next[key];
    }
    this.settings = next;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(next, null, 2), 'utf-8');
  }
}

export const appSettings = new AppSettingsStore();

/**
 * Validates a KUBECONFIG value: every entry (path.delimiter-separated) must be
 * an existing file. Throws a user-readable error otherwise.
 */
export async function assertKubeconfigPath(value: string): Promise<void> {
  const entries = value.split(path.delimiter).filter(Boolean);
  if (entries.length === 0) throw new Error('Kubeconfig path is empty');
  for (const entry of entries) {
    try {
      const stat = await fs.stat(entry);
      if (!stat.isFile()) throw new Error('not a file');
    } catch {
      throw new Error(`Kubeconfig file not found: ${entry}`);
    }
  }
}

/** Applies the saved kubeconfig path to this process (startup). */
export function applySavedKubeconfig(settings: AppSettings): void {
  if (settings.kubeconfigPath) {
    process.env.KUBECONFIG = settings.kubeconfigPath;
  }
}
