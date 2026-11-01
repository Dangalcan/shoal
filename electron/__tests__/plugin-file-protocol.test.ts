import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  toPluginFileUrl,
  fromPluginFileUrl,
  toFrameSafeUrl,
} from '../shared/plugin-file-url';

vi.mock('../logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: vi.fn(), getAppPath: vi.fn() },
  net: { fetch: vi.fn() },
}));

import { app, net } from 'electron';
import { pathToFileURL } from 'url';
import {
  handlePluginFileRequest,
  resolvePluginFile,
  withPluginCsp,
  isPluginHostDocument,
  PLUGIN_FILE_CSP,
} from '../services/plugins/plugin-file-protocol';

describe('plugin-file URL codec', () => {
  it('round-trips a Windows path', () => {
    const url = toPluginFileUrl(
      'C:\\Users\\Ana Pérez\\plugins\\demo\\renderer.js'
    );
    expect(url).toBe(
      'plugin-file://local/C%3A/Users/Ana%20P%C3%A9rez/plugins/demo/renderer.js'
    );
    expect(fromPluginFileUrl(url, 'win32')).toBe(
      'C:/Users/Ana Pérez/plugins/demo/renderer.js'
    );
  });

  it('round-trips a POSIX path', () => {
    const url = toPluginFileUrl(
      '/home/ana/.config/Shoal/plugins/demo/style.css'
    );
    expect(url).toBe(
      'plugin-file://local/home/ana/.config/Shoal/plugins/demo/style.css'
    );
    expect(fromPluginFileUrl(url, 'linux')).toBe(
      '/home/ana/.config/Shoal/plugins/demo/style.css'
    );
  });

  it('rejects other schemes, other hosts and malformed URLs', () => {
    expect(fromPluginFileUrl('file:///etc/passwd', 'linux')).toBeNull();
    expect(
      fromPluginFileUrl('plugin-file://evil/etc/passwd', 'linux')
    ).toBeNull();
    expect(
      fromPluginFileUrl('plugin-file://local/%E0%A4%A', 'linux')
    ).toBeNull();
    expect(fromPluginFileUrl('not a url', 'linux')).toBeNull();
  });

  it('rewrites file: URLs for sandboxed frames and leaves others alone', () => {
    expect(
      toFrameSafeUrl(
        'file:///C:/Program%20Files/Shoal/resources/app.asar/dist/plugin-host/index.html'
      )
    ).toBe(
      'plugin-file://local/C%3A/Program%20Files/Shoal/resources/app.asar/dist/plugin-host/index.html'
    );
    expect(
      toFrameSafeUrl('file:///opt/Shoal/resources/app.asar/dist/a.css')
    ).toBe('plugin-file://local/opt/Shoal/resources/app.asar/dist/a.css');
    expect(toFrameSafeUrl('http://localhost:5173/plugin-host/index.html')).toBe(
      'http://localhost:5173/plugin-host/index.html'
    );
  });

  it('requires a drive letter on Windows', () => {
    expect(
      fromPluginFileUrl('plugin-file://local/Users/x/renderer.js', 'win32')
    ).toBeNull();
  });
});

describe('resolvePluginFile', () => {
  let tmp: string;
  let pluginsRoot: string;
  let insideFile: string;
  let outsideFile: string;

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-plugin-file-'));
    pluginsRoot = path.join(tmp, 'plugins');
    fs.mkdirSync(path.join(pluginsRoot, 'demo'), { recursive: true });
    insideFile = path.join(pluginsRoot, 'demo', 'renderer.js');
    fs.writeFileSync(insideFile, 'console.log(1)');
    outsideFile = path.join(tmp, 'kubeconfig');
    fs.writeFileSync(outsideFile, 'secret');
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('serves a file inside a plugin directory', async () => {
    const resolved = await resolvePluginFile(toPluginFileUrl(insideFile), [
      pluginsRoot,
    ]);
    expect(resolved).toBe(fs.realpathSync(insideFile));
  });

  it('refuses a file outside every plugin directory', async () => {
    expect(
      await resolvePluginFile(toPluginFileUrl(outsideFile), [pluginsRoot])
    ).toBeNull();
  });

  it('refuses .. traversal out of the plugin directory', async () => {
    const sneaky = toPluginFileUrl(
      path.join(pluginsRoot, 'demo', '%2E%2E', '%2E%2E', 'kubeconfig')
    ).replace(/%25/g, '%');
    expect(await resolvePluginFile(sneaky, [pluginsRoot])).toBeNull();
  });

  it('refuses a URL that is not a plugin-file: URL', async () => {
    expect(
      await resolvePluginFile(pathToFileURL(insideFile).toString(), [
        pluginsRoot,
      ])
    ).toBeNull();
  });

  it('refuses missing files and missing roots', async () => {
    expect(
      await resolvePluginFile(
        toPluginFileUrl(path.join(pluginsRoot, 'demo', 'nope.js')),
        [pluginsRoot]
      )
    ).toBeNull();
    expect(
      await resolvePluginFile(toPluginFileUrl(insideFile), [
        path.join(tmp, 'does-not-exist'),
      ])
    ).toBeNull();
  });
});

describe('handlePluginFileRequest', () => {
  it('answers a refused request with 403 and the frame policy', async () => {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-proto-'));
    vi.mocked(app.getPath).mockReturnValue(userData);
    vi.mocked(app.getAppPath).mockReturnValue(userData);
    try {
      const outside = path.join(os.tmpdir(), 'elsewhere', 'renderer.js');
      const response = await handlePluginFileRequest(
        new Request(toPluginFileUrl(outside))
      );
      expect(response.status).toBe(403);
      expect(response.headers.get('Content-Security-Policy')).toBe(
        PLUGIN_FILE_CSP
      );
    } finally {
      fs.rmSync(userData, { recursive: true, force: true });
    }
  });

  it('serves a file of a user plugin through net.fetch with the frame policy', async () => {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-proto-'));
    vi.mocked(app.getPath).mockReturnValue(userData);
    vi.mocked(app.getAppPath).mockReturnValue(userData);
    vi.mocked(net.fetch).mockResolvedValue(
      new Response('console.log(1)', {
        status: 200,
        headers: { 'content-type': 'text/javascript' },
      })
    );
    try {
      const file = path.join(userData, 'plugins', 'demo', 'renderer.js');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'console.log(1)');

      const response = await handlePluginFileRequest(
        new Request(toPluginFileUrl(file))
      );

      expect(net.fetch).toHaveBeenCalledWith(
        pathToFileURL(fs.realpathSync(file)).toString()
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/javascript');
      expect(response.headers.get('Content-Security-Policy')).toBe(
        PLUGIN_FILE_CSP
      );
      expect(await response.text()).toBe('console.log(1)');
    } finally {
      fs.rmSync(userData, { recursive: true, force: true });
    }
  });
});

describe('plugin frame policy', () => {
  it('attaches the frame CSP and keeps the rest of the response', async () => {
    const original = new Response('<html></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });
    const response = withPluginCsp(original);
    expect(response.headers.get('Content-Security-Policy')).toBe(
      PLUGIN_FILE_CSP
    );
    expect(response.headers.get('content-type')).toBe('text/html');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<html></html>');
    expect(PLUGIN_FILE_CSP).toContain("connect-src 'none'");
  });

  it('recognises the host document and nothing else', () => {
    expect(
      isPluginHostDocument(
        'plugin-file://local/C%3A/Shoal/resources/app.asar/dist/plugin-host/index.html'
      )
    ).toBe(true);
    expect(
      isPluginHostDocument('http://localhost:5173/plugin-host/index.html?x=1')
    ).toBe(true);
    expect(
      isPluginHostDocument(
        'plugin-file://local/home/ana/plugins/evil/page.html'
      )
    ).toBe(false);
    expect(isPluginHostDocument('https://example.com/')).toBe(false);
  });
});
