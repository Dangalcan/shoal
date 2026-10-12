import { describe, it, expect, vi } from 'vitest';
import { dataLoader } from '../services/plugins/data-loader';
import { readFile } from 'fs/promises';
import path from 'path';

vi.mock('fs/promises', () => {
  const readFile = vi.fn();
  return {
    readFile,
    default: {
      readFile,
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      unlink: vi.fn(),
      readdir: vi.fn(),
    },
  };
});

describe('DataLoader', () => {
  const mockManifest = {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    data: ['data/config.json', 'data/presets.yaml'],
  } as any;

  it('should load JSON and YAML files', async () => {
    const jsonContent = JSON.stringify({ key: 'value' });
    const yamlContent = 'foo: bar\nbaz: 123';

    (readFile as any).mockResolvedValueOnce(jsonContent);
    (readFile as any).mockResolvedValueOnce(yamlContent);

    const result = await dataLoader.loadPluginData('/mock/path', mockManifest);

    expect(result.length).toBe(2);
    expect(result[0].path).toBe('data/config.json');
    expect(result[0].content).toEqual({ key: 'value' });
    expect(result[1].path).toBe('data/presets.yaml');
    expect(result[1].content).toEqual({ foo: 'bar', baz: 123 });
  });

  it('should handle unsupported formats gracefully', async () => {
    const manifest = { ...mockManifest, data: ['unsupported.txt'] };
    (readFile as any).mockResolvedValue('some text');

    const result = await dataLoader.loadPluginData('/mock/path', manifest);
    expect(result.length).toBe(0); // Skips unsupported formats
  });

  it('returns an empty list when the manifest declares no data files', async () => {
    const noData = { ...mockManifest, data: undefined };
    expect(await dataLoader.loadPluginData('/mock/path', noData)).toEqual([]);

    const emptyData = { ...mockManifest, data: [] };
    expect(await dataLoader.loadPluginData('/mock/path', emptyData)).toEqual(
      []
    );
    expect(readFile).not.toHaveBeenCalled();
  });

  it('supports the .yml extension', async () => {
    const manifest = { ...mockManifest, data: ['data/config.yml'] };
    (readFile as any).mockResolvedValueOnce('answer: 42');

    const result = await dataLoader.loadPluginData('/mock/path', manifest);
    expect(result).toEqual([
      { path: 'data/config.yml', content: { answer: 42 } },
    ]);
  });

  it('loads an empty YAML file as undefined instead of failing', async () => {
    const manifest = { ...mockManifest, data: ['data/empty.yaml'] };
    (readFile as any).mockResolvedValueOnce('\n');

    const result = await dataLoader.loadPluginData('/mock/path', manifest);
    expect(result).toEqual([{ path: 'data/empty.yaml', content: undefined }]);
  });

  it('throws a descriptive error when a data file cannot be read', async () => {
    const manifest = { ...mockManifest, data: ['data/missing.json'] };
    (readFile as any).mockRejectedValueOnce(new Error('ENOENT'));

    await expect(
      dataLoader.loadPluginData('/mock/path', manifest)
    ).rejects.toThrow(/Failed to load data file data\/missing\.json: ENOENT/);
  });

  it('reads files relative to the plugin path', async () => {
    const manifest = { ...mockManifest, data: ['data/config.json'] };
    (readFile as any).mockResolvedValueOnce('{}');

    await dataLoader.loadPluginData('/plugins/p1', manifest);
    expect(readFile).toHaveBeenCalledWith(
      path.join('/plugins/p1', 'data/config.json'),
      'utf-8'
    );
  });

  it('should apply data to storage', async () => {
    const dataFiles = [{ path: 'data/config.json', content: { a: 1 } }];
    const mockStorage = {
      set: vi.fn().mockResolvedValue(undefined),
    } as any;

    await dataLoader.applyDataToStorage('test-plugin', dataFiles, mockStorage);

    // data/config.json is stored as "data/config", not "data/data/config".
    expect(mockStorage.set).toHaveBeenCalledWith('data/config', {
      a: 1,
    });
  });
});
