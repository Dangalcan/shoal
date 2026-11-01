/**
 * plugin-file: URL helpers shared by the renderer (sandboxed plugin frames)
 * and the main process (the plugin-file protocol handler).
 */
import { describe, it, expect } from 'vitest';
import {
  fromPluginFileUrl,
  toFrameSafeUrl,
  toPluginFileUrl,
} from '../shared/plugin-file-url';

describe('toPluginFileUrl', () => {
  it('percent-encodes every segment of a Windows path', () => {
    expect(toPluginFileUrl('C:\\Users\\ana\\My Plugins\\a#b\\index.js')).toBe(
      'plugin-file://local/C%3A/Users/ana/My%20Plugins/a%23b/index.js'
    );
  });

  it('keeps a POSIX root inside the path', () => {
    expect(toPluginFileUrl('/home/ana/.shoal/plugins/x/main.js')).toBe(
      'plugin-file://local/home/ana/.shoal/plugins/x/main.js'
    );
  });
});

describe('toFrameSafeUrl', () => {
  it('rewrites file: URLs to plugin-file:', () => {
    expect(
      toFrameSafeUrl('file:///C:/Program%20Files/Shoal/plugins/a/index.js')
    ).toBe('plugin-file://local/C%3A/Program%20Files/Shoal/plugins/a/index.js');
  });

  it('leaves http: URLs from the dev server alone', () => {
    const href = 'http://localhost:4173/plugins/a/index.js';
    expect(toFrameSafeUrl(href)).toBe(href);
  });

  it('returns a value that is not a URL unchanged', () => {
    expect(toFrameSafeUrl('plugins/a/index.js')).toBe('plugins/a/index.js');
    expect(toFrameSafeUrl('')).toBe('');
  });
});

describe('fromPluginFileUrl', () => {
  it('round-trips a Windows path', () => {
    const url = toPluginFileUrl('C:\\Users\\ana\\My Plugins\\index.js');
    expect(fromPluginFileUrl(url, 'win32')).toBe(
      'C:/Users/ana/My Plugins/index.js'
    );
  });

  it('round-trips a POSIX path', () => {
    const url = toPluginFileUrl('/opt/shoal/plugins/a b/index.js');
    expect(fromPluginFileUrl(url, 'linux')).toBe(
      '/opt/shoal/plugins/a b/index.js'
    );
  });

  it.each([
    ['a malformed URL', 'not a url'],
    ['another scheme', 'file:///C:/x/index.js'],
    ['another host', 'plugin-file://remote/C%3A/x/index.js'],
    ['broken percent-encoding', 'plugin-file://local/C%3A/x/%E0%A4%A.js'],
  ])('rejects %s', (_label, url) => {
    expect(fromPluginFileUrl(url, 'win32')).toBeNull();
  });

  it('rejects a Windows path without a drive letter', () => {
    expect(
      fromPluginFileUrl('plugin-file://local/Users/ana/index.js', 'win32')
    ).toBeNull();
  });
});
