/**
 * plugin-file: protocol handler.
 *
 * Serves plugin renderer assets to the sandboxed plugin frames, plus the
 * frames' own host document and the app stylesheets (packaged builds load the
 * app from file:, which opaque-origin frames may not use). A request is only
 * answered when the file, after resolving symlinks, lives inside one of the
 * plugin discovery directories (user plugins and bundled plugins) or the
 * app's built renderer directory; anything else gets a 403. Without this check any document, including a
 * plugin frame, could read arbitrary files such as ~/.kube/config.
 */

import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { net } from 'electron';
import log from '../../logger';
import { isPathInside } from '../../utils/fs-utils';
import { fromPluginFileUrl } from '../../shared/plugin-file-url';
import { pathService } from './path-service';

async function realpathOrNull(target: string): Promise<string | null> {
  try {
    return await fs.realpath(target);
  } catch {
    return null;
  }
}

/**
 * Resolves a plugin-file: URL to a real file inside one of `roots`, or null.
 */
export async function resolvePluginFile(
  url: string,
  roots: string[],
  platform: string = process.platform
): Promise<string | null> {
  const requested = fromPluginFileUrl(url, platform);
  if (!requested) return null;

  const real = await realpathOrNull(path.normalize(requested));
  if (!real) return null;

  for (const root of roots) {
    const realRoot = await realpathOrNull(root);
    if (realRoot && isPathInside(realRoot, real)) return real;
  }
  return null;
}

/**
 * The policy of the plugin frames, sent with every plugin-file: response.
 * The host document (public/plugin-host/index.html) carries the same text in
 * a <meta>; the header makes sure any other document a frame could show
 * keeps it: no network, no plugins, no forms, no nested frames.
 */
export const PLUGIN_FILE_CSP = [
  "default-src 'none'",
  "script-src 'self' plugin-file:",
  "style-src 'self' 'unsafe-inline' plugin-file:",
  "img-src 'self' data: blob: plugin-file:",
  "font-src 'self' data: plugin-file:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
].join('; ');

/** True for the plugin frames' host document (dev server or plugin-file:). */
export function isPluginHostDocument(url: string): boolean {
  return /\/plugin-host\/index\.html(?:[?#]|$)/.test(url);
}

/** Returns the same response with the plugin frame policy attached. */
export function withPluginCsp(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', PLUGIN_FILE_CSP);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** `protocol.handle('plugin-file', ...)` callback. */
export async function handlePluginFileRequest(
  request: Request
): Promise<Response> {
  const file = await resolvePluginFile(request.url, [
    ...pathService.getDiscoveryDirectories(),
    pathService.getAppDistDir(),
  ]);
  if (!file) {
    log.warn(`[Protocol] Refused plugin-file request: ${request.url}`);
    return new Response('Forbidden', { status: 403 });
  }
  return withPluginCsp(await net.fetch(pathToFileURL(file).toString()));
}
