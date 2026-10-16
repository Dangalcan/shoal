import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain, dialog } from 'electron';
import { registerMigrationIpcHandlers } from '../ipc/migration-ipc';
import { migrationService } from '../services/migration/migration-service';
import { pluginEventBus } from '../services/plugins/plugin-events';
import { manifestDb } from '../database';

vi.mock('../logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
}));

vi.mock('../services/migration/migration-service', () => ({
  migrationService: {
    checkKompose: vi.fn(),
    convertComposeFile: vi.fn(),
  },
}));

vi.mock('../services/plugins/plugin-events', () => ({
  pluginEventBus: {
    getMainWindow: vi.fn(() => ({})),
  },
}));

vi.mock('../database', () => ({
  manifestDb: {
    saveFolder: vi.fn(),
    saveManifest: vi.fn(),
  },
}));

type IpcHandler = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

const mockEvent = {} as IpcMainInvokeEvent;

function getHandler(channel: string): IpcHandler {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as IpcHandler;
}

const validImportArgs = {
  projectName: 'my-shop',
  contextName: 'kind-test',
  manifests: [
    { name: 'web-deployment.yaml', content: 'kind: Deployment' },
    { name: 'web-service.yaml', content: 'kind: Service' },
  ],
};

describe('migration-ipc handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerMigrationIpcHandlers();
  });

  describe('migration:check-kompose', () => {
    it('delegates to the migration service', async () => {
      vi.mocked(migrationService.checkKompose).mockResolvedValue({
        available: true,
        version: '1.34.0',
      });

      const result = await getHandler('migration:check-kompose')(mockEvent);

      expect(result).toEqual({
        success: true,
        data: { available: true, version: '1.34.0' },
      });
    });
  });

  describe('migration:select-compose-file', () => {
    it('returns the chosen path', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: ['C:/project/docker-compose.yml'],
      });

      const result = await getHandler('migration:select-compose-file')(
        mockEvent
      );

      expect(result).toEqual({
        success: true,
        data: {
          token: expect.any(String),
          filePath: 'C:/project/docker-compose.yml',
        },
      });
    });

    it('returns null when the dialog is cancelled', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: true,
        filePaths: [],
      });

      const result = await getHandler('migration:select-compose-file')(
        mockEvent
      );

      expect(result).toEqual({ success: true, data: null });
    });

    it('fails when no window is available', async () => {
      vi.mocked(pluginEventBus.getMainWindow).mockReturnValue(null);

      const result = await getHandler('migration:select-compose-file')(
        mockEvent
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/no window/i);
    });
  });

  describe('migration:convert', () => {
    /** Picks a file through the dialog and returns the token it was given. */
    async function selectFile(
      filePath = 'C:/project/docker-compose.yml'
    ): Promise<string> {
      vi.mocked(pluginEventBus.getMainWindow).mockReturnValue({} as never);
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: [filePath],
      });
      const result = await getHandler('migration:select-compose-file')(
        mockEvent
      );
      return (result.data as { token: string }).token;
    }

    it('converts the file behind a token from the dialog', async () => {
      const conversion = {
        manifests: [
          {
            fileName: 'web-deployment.yaml',
            kind: 'Deployment',
            name: 'web',
            content: 'kind: Deployment',
          },
        ],
        warnings: [],
        locallyBuiltImages: [],
      };
      vi.mocked(migrationService.convertComposeFile).mockResolvedValue(
        conversion
      );

      const token = await selectFile();
      const result = await getHandler('migration:convert')(mockEvent, token);

      expect(result).toEqual({ success: true, data: conversion });
      expect(migrationService.convertComposeFile).toHaveBeenCalledWith(
        'C:/project/docker-compose.yml'
      );
    });

    it('never takes a path from the renderer', async () => {
      const result = await getHandler('migration:convert')(
        mockEvent,
        'C:/project/docker-compose.yml'
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/pick the file again/i);
      expect(migrationService.convertComposeFile).not.toHaveBeenCalled();
    });

    it('rejects a missing token', async () => {
      const result = await getHandler('migration:convert')(mockEvent, '   ');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/token is required/i);
      expect(migrationService.convertComposeFile).not.toHaveBeenCalled();
    });

    it('keeps the newest selections and forgets the oldest', async () => {
      const first = await selectFile('C:/project/first.yml');
      for (let i = 0; i < 8; i++) {
        await selectFile(`C:/project/later-${i}.yml`);
      }
      vi.mocked(migrationService.convertComposeFile).mockResolvedValue({
        manifests: [],
        warnings: [],
        locallyBuiltImages: [],
      });

      const expired = await getHandler('migration:convert')(mockEvent, first);
      expect(expired.success).toBe(false);

      const latest = await selectFile('C:/project/latest.yml');
      const result = await getHandler('migration:convert')(mockEvent, latest);
      expect(result.success).toBe(true);
      expect(migrationService.convertComposeFile).toHaveBeenCalledWith(
        'C:/project/latest.yml'
      );
    });
  });

  describe('migration:import', () => {
    it('creates a folder and saves every manifest into it', async () => {
      vi.mocked(manifestDb.saveFolder).mockReturnValue(42);
      vi.mocked(manifestDb.saveManifest)
        .mockReturnValueOnce(7)
        .mockReturnValueOnce(8);

      const result = await getHandler('migration:import')(
        mockEvent,
        validImportArgs
      );

      expect(result).toEqual({
        success: true,
        data: { folderId: 42, manifestIds: [7, 8] },
      });
      expect(manifestDb.saveFolder).toHaveBeenCalledWith({
        name: 'my-shop',
        parent_id: null,
      });
      expect(manifestDb.saveManifest).toHaveBeenCalledWith({
        name: 'web-deployment.yaml',
        cluster_context: 'kind-test',
        content: 'kind: Deployment',
        folder_id: 42,
      });
    });

    it('rejects an empty project name', async () => {
      const result = await getHandler('migration:import')(mockEvent, {
        ...validImportArgs,
        projectName: '  ',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/project name/i);
      expect(manifestDb.saveFolder).not.toHaveBeenCalled();
    });

    it('rejects an invalid context name', async () => {
      const result = await getHandler('migration:import')(mockEvent, {
        ...validImportArgs,
        contextName: 'bad context;rm',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid context/i);
      expect(manifestDb.saveFolder).not.toHaveBeenCalled();
    });

    it('rejects an empty manifest list', async () => {
      const result = await getHandler('migration:import')(mockEvent, {
        ...validImportArgs,
        manifests: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/at least one manifest/i);
      expect(manifestDb.saveFolder).not.toHaveBeenCalled();
    });

    it('rejects a project name over 100 characters', async () => {
      const result = await getHandler('migration:import')(mockEvent, {
        ...validImportArgs,
        projectName: 'x'.repeat(101),
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/at most 100 characters/);
      expect(manifestDb.saveFolder).not.toHaveBeenCalled();
    });

    it('rejects a manifest entry that is not an object', async () => {
      const result = await getHandler('migration:import')(mockEvent, {
        ...validImportArgs,
        manifests: [null],
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid manifest entry/);
    });

    it('rejects a manifest without a name, or with a name over 200 characters', async () => {
      const unnamed = await getHandler('migration:import')(mockEvent, {
        ...validImportArgs,
        manifests: [{ name: ' ', content: 'kind: Pod' }],
      });
      expect(unnamed.success).toBe(false);
      expect(unnamed.error).toMatch(/Manifest name is required/);

      const long = await getHandler('migration:import')(mockEvent, {
        ...validImportArgs,
        manifests: [{ name: 'n'.repeat(201), content: 'kind: Pod' }],
      });
      expect(long.success).toBe(false);
      expect(long.error).toMatch(/at most 200 characters/);
      expect(manifestDb.saveFolder).not.toHaveBeenCalled();
    });

    it('rejects a manifest over 1 MiB', async () => {
      const result = await getHandler('migration:import')(mockEvent, {
        ...validImportArgs,
        manifests: [{ name: 'big.yaml', content: 'x'.repeat(1024 * 1024 + 1) }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/too large/);
      expect(manifestDb.saveFolder).not.toHaveBeenCalled();
    });

    it('rejects a manifest without content', async () => {
      const result = await getHandler('migration:import')(mockEvent, {
        ...validImportArgs,
        manifests: [{ name: 'web-deployment.yaml', content: '' }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/no content/i);
      expect(manifestDb.saveFolder).not.toHaveBeenCalled();
    });
  });
});
