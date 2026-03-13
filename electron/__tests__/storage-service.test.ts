import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService } from '../services/plugins/storage-service';
import { pathService } from '../services/plugins/path-service';
import fs from 'fs/promises';
import path from 'path';

vi.mock('../logger', () => ({
  default: {
    error: (...args: unknown[]) => console.error(...args),
    warn: (...args: unknown[]) => console.warn(...args),
    info: (...args: unknown[]) => console.log(...args),
    debug: (...args: unknown[]) => console.debug(...args),
    verbose: (...args: unknown[]) => console.log(...args),
  },
}));

// Mock better-sqlite3
vi.mock('better-sqlite3', () => {
  const mockDb = {
    exec: vi.fn(),
    prepare: vi.fn().mockReturnValue({
      get: vi.fn(),
      run: vi.fn(),
    }),
    close: vi.fn(),
  };
  return {
    default: class {
      constructor() {
        return mockDb;
      }
    },
  };
});

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/user/data'),
  },
}));

vi.mock('../services/plugins/path-service', () => ({
  pathService: {
    getPluginStorageDir: vi
      .fn()
      .mockReturnValue('/mock/user/data/plugin-storage/test-p'),
  },
}));

vi.mock('fs/promises', () => ({
  default: {
    readdir: vi.fn(),
    readFile: vi.fn(),
    rename: vi.fn(),
  },
}));

describe('StorageService', () => {
  let storageService: StorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    storageService = new StorageService();
  });

  it('should call set and get correctly', () => {
    const db = (storageService as any).db;
    const prepareSpy = vi.spyOn(db, 'prepare');

    // Test successful get
    const getMock = vi
      .fn()
      .mockReturnValue({ value: JSON.stringify({ a: 1 }) });
    prepareSpy.mockReturnValue({ get: getMock, run: vi.fn() } as any);
    const val = storageService.get('test-p', 'key');
    expect(val).toEqual({ a: 1 });
    expect(prepareSpy).toHaveBeenCalledWith(
      expect.stringContaining('SELECT value')
    );

    // Test get with no row
    getMock.mockReturnValue(undefined);
    expect(storageService.get('test-p', 'key')).toBeNull();

    // Test get with parse error
    getMock.mockReturnValue({ value: 'invalid-json' });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(storageService.get('test-p', 'key')).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse value')
    );
    consoleSpy.mockRestore();

    // Test set
    storageService.set('test-p', 'key', { b: 2 });
    expect(prepareSpy).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO plugin_kv')
    );
  });

  it('should delete a key', () => {
    const db = (storageService as any).db;
    const prepareSpy = vi.spyOn(db, 'prepare');
    storageService.delete('test-id', 'test-key');
    expect(prepareSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'DELETE FROM plugin_kv WHERE plugin_id = ? AND key = ?'
      )
    );
  });

  it('should clear all keys for a plugin', () => {
    const db = (storageService as any).db;
    const prepareSpy = vi.spyOn(db, 'prepare');
    storageService.clear('test-id');
    expect(prepareSpy).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM plugin_kv WHERE plugin_id = ?')
    );
  });

  it('should handle JSON migration', async () => {
    const pluginId = 'test-p';
    // Success case
    vi.mocked(fs.readdir).mockResolvedValue([
      'config.json',
      'other.txt',
    ] as any);
    vi.mocked(fs.readFile).mockResolvedValue('{"enabled": true}');

    const setSpy = vi.spyOn(storageService, 'set').mockImplementation(() => {});

    await storageService.migrateFromJson(pluginId);

    expect(setSpy).toHaveBeenCalledWith(pluginId, 'config', { enabled: true });
    expect(fs.rename).toHaveBeenCalled();

    // Loop catch block (JSON parse error)
    vi.mocked(fs.readFile).mockResolvedValue('invalid-json');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await storageService.migrateFromJson(pluginId);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Migration failed'),
      expect.any(String)
    );
    consoleSpy.mockRestore();
  });

  it('should skip migration if no json files found', async () => {
    vi.mocked(fs.readdir).mockResolvedValue(['data.txt'] as any);
    await storageService.migrateFromJson('test-p');
    expect(fs.readFile).not.toHaveBeenCalled();
  });

  it('should handle migration errors', async () => {
    // ENOENT should be ignored
    vi.mocked(fs.readdir).mockRejectedValue({ code: 'ENOENT' });
    await expect(storageService.migrateFromJson('none')).resolves.not.toThrow();

    // Other errors should be logged
    const error = new Error('Generic error');
    (error as any).code = 'EPERM';
    vi.mocked(fs.readdir).mockRejectedValue(error);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await storageService.migrateFromJson('test-error');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Migration error'),
      expect.any(String)
    );
    consoleSpy.mockRestore();
  });

  it('should not re-initialize database if already exists', () => {
    const db = (storageService as any).db;
    (storageService as any).initialize();
    expect((storageService as any).db).toBe(db);
  });
});
