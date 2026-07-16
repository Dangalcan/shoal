/**
 * Migration IPC Handlers
 *
 * Covers: kompose availability check, compose file selection, compose →
 * Kubernetes conversion, and importing the converted manifests into the
 * manifest library.
 */

import { ipcMain, dialog } from 'electron';
import { wrapIpcHandler, assertContext } from './ipc-utils';
import { migrationService } from '../services/migration/migration-service';
import { pluginEventBus } from '../services/plugins/plugin-events';
import { manifestDb } from '../database';
import type {
  MigrationImportArgs,
  MigrationImportResult,
  MigrationManifestEntry,
} from '../types/migration-types';

const MAX_PROJECT_NAME_LENGTH = 100;
const MAX_MANIFEST_NAME_LENGTH = 200;
/** Same ceiling the compose input has; a single manifest never exceeds it. */
const MAX_MANIFEST_CONTENT_SIZE = 1024 * 1024;

function assertProjectName(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Project name is required');
  }
  if (value.trim().length > MAX_PROJECT_NAME_LENGTH) {
    throw new Error(
      `Project name must be at most ${MAX_PROJECT_NAME_LENGTH} characters`
    );
  }
}

function assertManifestEntries(
  value: unknown
): asserts value is MigrationManifestEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('At least one manifest is required');
  }
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Invalid manifest entry');
    }
    const { name, content } = entry as MigrationManifestEntry;
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error('Manifest name is required');
    }
    if (name.trim().length > MAX_MANIFEST_NAME_LENGTH) {
      throw new Error(
        `Manifest name must be at most ${MAX_MANIFEST_NAME_LENGTH} characters`
      );
    }
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error(`Manifest "${name}" has no content`);
    }
    if (content.length > MAX_MANIFEST_CONTENT_SIZE) {
      throw new Error(`Manifest "${name}" is too large (max 1 MiB)`);
    }
  }
}

export function registerMigrationIpcHandlers(): void {
  ipcMain.handle(
    'migration:check-kompose',
    wrapIpcHandler('migration:check-kompose', async () => {
      return await migrationService.checkKompose();
    })
  );

  ipcMain.handle(
    'migration:select-compose-file',
    wrapIpcHandler('migration:select-compose-file', async () => {
      const win = pluginEventBus.getMainWindow();
      if (!win) throw new Error('No window available');

      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: 'Select Docker Compose File',
        properties: ['openFile'],
        buttonLabel: 'Convert',
        filters: [
          { name: 'Docker Compose', extensions: ['yml', 'yaml'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (canceled || filePaths.length === 0) return null;
      return filePaths[0];
    })
  );

  ipcMain.handle(
    'migration:convert',
    wrapIpcHandler('migration:convert', async (_event, filePath: unknown) => {
      if (typeof filePath !== 'string' || !filePath.trim()) {
        throw new Error('Compose file path is required');
      }
      return await migrationService.convertComposeFile(filePath);
    })
  );

  ipcMain.handle(
    'migration:import',
    wrapIpcHandler(
      'migration:import',
      async (_event, args: MigrationImportArgs) => {
        assertProjectName(args?.projectName);
        assertContext(args.contextName);
        assertManifestEntries(args.manifests);

        const folderId = manifestDb.saveFolder({
          name: args.projectName.trim(),
          parent_id: null,
        });
        const manifestIds = args.manifests.map((manifest) =>
          manifestDb.saveManifest({
            name: manifest.name.trim(),
            cluster_context: args.contextName,
            content: manifest.content,
            folder_id: folderId,
          })
        );

        const result: MigrationImportResult = { folderId, manifestIds };
        return result;
      }
    )
  );
}
