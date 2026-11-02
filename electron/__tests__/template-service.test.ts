import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => {
  const m = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
  return { ...m, default: m };
});

import fs from 'fs/promises';
import vm from 'vm';
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

    it('should register a sidebar item for the plugin route in activate()', async () => {
      await service.scaffoldPlugin('/output/my-plugin', options);

      const writeFileCalls = vi.mocked(fs.writeFile).mock.calls;
      const manifestCall = writeFileCalls.find((call) =>
        (call[0] as string).endsWith('plugin.json')
      )!;
      expect(JSON.parse(manifestCall[1] as string).extensions).toBeUndefined();

      const indexCall = writeFileCalls.find((call) =>
        (call[0] as string).endsWith('index.js')
      )!;
      const registered: unknown[] = [];
      const pluginModule: { exports: { activate?: (c: unknown) => void } } = {
        exports: {},
      };
      new Function('module', indexCall[1] as string)(pluginModule);
      pluginModule.exports.activate?.({
        logger: { info: () => {} },
        ui: {
          showNotification: () => {},
          registerSidebarItem: (item: unknown) => registered.push(item),
        },
      });

      expect(registered).toEqual([
        {
          id: 'my-plugin-page',
          label: options.name,
          route: '/plugin/my-plugin',
        },
      ]);
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

    it('should write a sandboxed renderer.js using window.k8sPlugin', async () => {
      await service.scaffoldPlugin('/output/my-plugin', options);

      const writeFileCalls = vi.mocked(fs.writeFile).mock.calls;
      const rendererCall = writeFileCalls.find((call) =>
        (call[0] as string).endsWith('renderer.js')
      );
      expect(rendererCall).toBeDefined();

      const content = rendererCall![1] as string;
      expect(content).toContain('window.k8sPlugin');
      // Must NOT reach for host globals — the iframe has none of these.
      expect(content).not.toContain('window.electron');
      expect(content).not.toContain('pluginUIRegistry');
    });

    it('should declare the renderer entry in the manifest', async () => {
      await service.scaffoldPlugin('/output/my-plugin', options);
      const manifestCall = vi
        .mocked(fs.writeFile)
        .mock.calls.find((call) => (call[0] as string).endsWith('plugin.json'));
      const manifest = JSON.parse(manifestCall![1] as string);
      expect(manifest.renderer).toBe('renderer.js');
    });

    it('should write exactly three files (plugin.json + index.js + renderer.js)', async () => {
      await service.scaffoldPlugin('/output/my-plugin', options);
      expect(fs.writeFile).toHaveBeenCalledTimes(3);
    });

    it('should keep hostile names out of the generated code', async () => {
      const hostile = {
        ...options,
        name: `x'); require('child_process'); /* */ <img src=x onerror=alert(1)>\n`,
      };
      await service.scaffoldPlugin('/output/my-plugin', hostile);

      for (const file of ['index.js', 'renderer.js']) {
        const call = vi
          .mocked(fs.writeFile)
          .mock.calls.find((c) => (c[0] as string).endsWith(file));
        const source = call![1] as string;
        // Still valid JavaScript, and the name only appears as a JSON literal.
        expect(() => new vm.Script(source)).not.toThrow();
        expect(source).toContain(JSON.stringify(hostile.name));
        expect(source).not.toMatch(/\.innerHTML\s*=/);
      }
    });

    it('should propagate fs errors', async () => {
      vi.mocked(fs.mkdir).mockRejectedValueOnce(new Error('Permission denied'));
      await expect(
        service.scaffoldPlugin('/forbidden', options)
      ).rejects.toThrow('Permission denied');
    });
  });
});
