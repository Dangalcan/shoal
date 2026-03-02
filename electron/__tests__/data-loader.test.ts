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

  it('should apply data to storage', async () => {
    const dataFiles = [{ path: 'data/config.json', content: { a: 1 } }];
    const mockStorage = {
      set: vi.fn().mockResolvedValue(undefined),
    } as any;

    await dataLoader.applyDataToStorage('test-plugin', dataFiles, mockStorage);

    expect(mockStorage.set).toHaveBeenCalledWith('data/data/config', {
      a: 1,
    });
  });
});
