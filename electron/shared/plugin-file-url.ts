/**
 * plugin-file: URLs for plugin renderer assets (entry script, stylesheets).
 *
 * Node-free on purpose: the renderer builds these URLs for sandboxed plugin
 * frames (src/features/plugins/sandbox/frame-props.ts) and the main process
 * resolves them back to files (services/plugins/plugin-file-protocol.ts).
 *
 * Format: plugin-file://local/<absolute path, forward slashes, every segment
 * percent-encoded>. The scheme is registered as `standard`, so whatever
 * follows `//` is parsed as the host; the fixed `local` host keeps Windows
 * drive letters and POSIX roots inside the path where they belong.
 */
export const PLUGIN_FILE_SCHEME = 'plugin-file';
export const PLUGIN_FILE_HOST = 'local';

/** Builds the plugin-file: URL for an absolute filesystem path. */
export function toPluginFileUrl(absolutePath: string): string {
  const segments = absolutePath
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment.length > 0)
    .map(encodeURIComponent);
  return `${PLUGIN_FILE_SCHEME}://${PLUGIN_FILE_HOST}/${segments.join('/')}`;
}

/**
 * Makes a URL loadable from a sandboxed plugin frame. Those frames have an
 * opaque origin and Chromium refuses to let them load file: resources ("Not
 * allowed to load local resource"), which is what packaged builds use. file:
 * URLs are rewritten to plugin-file:; anything else (the dev server's http:
 * URLs) is returned unchanged.
 */
export function toFrameSafeUrl(href: string): string {
  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return href;
  }
  if (parsed.protocol !== 'file:') return href;
  return toPluginFileUrl(decodeURIComponent(parsed.pathname));
}

/**
 * Returns the absolute path a plugin-file: URL points to, or null when the
 * URL is malformed, uses another scheme or host, or (on Windows) carries no
 * drive letter. The result is NOT trusted: callers must still check that it
 * resolves inside a plugin directory.
 */
export function fromPluginFileUrl(
  url: string,
  platform: string
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== `${PLUGIN_FILE_SCHEME}:` ||
    parsed.hostname !== PLUGIN_FILE_HOST
  ) {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }

  if (platform === 'win32') {
    // "/C:/Users/..." -> "C:/Users/..."
    return /^\/[A-Za-z]:\//.test(decoded) ? decoded.slice(1) : null;
  }
  return decoded;
}
