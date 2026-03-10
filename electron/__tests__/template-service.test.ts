import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => {
  const m = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
  return { ...m, default: m };
});

import fs from 'fs/promises';
import { TemplateService } from '../services/plugins/template-service';

describe('TemplateService', () => {
  let service: TemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TemplateService();
  });

  describe('scaffoldPlugin', () => {
    const options = {
      id: 'my-plugin',
      name: 'My Plugin',
      author: 'Alice',
      description: 'A test plugin',
    };

    it('should create the target directory recursively', async () => {
      await service.scaffoldPlugin('/output/my-plugin', options);

      expect(fs.mkdir).toHaveBeenCalledWith('/output/my-plugin', {
        recursive: true,
      });
    });

    it('should write plugin.json with correct manifest fields', async () => {
      await service.scaffoldPlugin('/output/my-plugin', options);

      const writeFileCalls = vi.mocked(fs.writeFile).mock.calls;
      const manifestCall = writeFileCalls.find((call) =>
        (call[0] as string).endsWith('plugin.json')
      );
      expect(manifestCall).toBeDefined();

      const manifest = JSON.parse(manifestCall![1] as string);
      expect(manifest.id).toBe('my-plugin');
      expect(manifest.name).toBe('My Plugin');
      expect(manifest.author).toBe('Alice');
      expect(manifest.description).toBe('A test plugin');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.main).toBe('index.js');
      expect(manifest.license.type).toBe('free');
      expect(manifest.license.spdx).toBe('MIT');
    });

    it('should include a sidebar extension pointing to the plugin route', async () => {
      await service.scaffoldPlugin('/output/my-plugin', options);

      const writeFileCalls = vi.mocked(fs.writeFile).mock.calls;
      const manifestCall = writeFileCalls.find((call) =>
        (call[0] as string).endsWith('plugin.json')
      )!;
      const manifest = JSON.parse(manifestCall[1] as string);

      expect(manifest.extensions.sidebar).toHaveLength(1);
      expect(manifest.extensions.sidebar[0].id).toBe('my-plugin-page');
      expect(manifest.extensions.sidebar[0].route).toBe('/plugin/my-plugin');
    });

    it('should include default configuration schema', async () => {
      await service.scaffoldPlugin('/output/my-plugin', options);

      const writeFileCalls = vi.mocked(fs.writeFile).mock.calls;
      const manifestCall = writeFileCalls.find((call) =>
        (call[0] as string).endsWith('plugin.json')
      )!;
      const manifest = JSON.parse(manifestCall[1] as string);

      expect(manifest.configuration.properties.enableFeatureX).toBeDefined();
      expect(manifest.configuration.properties.enableFeatureX.type).toBe(
        'boolean'
      );
    });

    it('should write index.js containing activate and deactivate', async () => {
      await service.scaffoldPlugin('/output/my-plugin', options);

      const writeFileCalls = vi.mocked(fs.writeFile).mock.calls;
      const indexCall = writeFileCalls.find((call) =>
        (call[0] as string).endsWith('index.js')
      );
      expect(indexCall).toBeDefined();

      const content = indexCall![1] as string;
      expect(content).toContain('activate');
      expect(content).toContain('deactivate');
      expect(content).toContain('My Plugin');
    });

    it('should write exactly two files (plugin.json + index.js)', async () => {
      await service.scaffoldPlugin('/output/my-plugin', options);
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should propagate fs errors', async () => {
      vi.mocked(fs.mkdir).mockRejectedValueOnce(new Error('Permission denied'));
      await expect(
        service.scaffoldPlugin('/forbidden', options)
      ).rejects.toThrow('Permission denied');
    });
  });
});
