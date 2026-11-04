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

import { realpathSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { app, net } from 'electron';
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
 * keeps it: no network, no plugins, no forms, no nested frames. Two things
 * are out of its reach: WebRTC, which the preload removes, and DNS
 * lookups through `<link rel="dns-prefetch">`, which nothing here can stop
 * (see SECURITY.md).
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

/** The path with links resolved, or as given when it does not exist. */
function resolveLinks(target: string): string {
  try {
    return realpathSync(target);
  } catch {
    return path.normalize(target);
  }
}

/**
 * True for the plugin frames' host document: the one in the app's build, or the
 * dev server's in development. The file name alone would not do: a plugin can
 * ship a `plugin-host/index.html` of its own, and a frame that moved to it would
 * leave behind what the real one sets up.
 */
export function isPluginHostDocument(
  url: string,
  platform: string = process.platform
): boolean {
  const requested = fromPluginFileUrl(url, platform);
  if (requested) {
    // The document URL and the app path can reach the file by different
    // routes when the install path goes through a junction or a symlink.
    const actual = resolveLinks(requested);
    const hostDocument = resolveLinks(
      path.join(pathService.getAppDistDir(), 'plugin-host', 'index.html')
    );
    return platform === 'win32'
      ? actual.toLowerCase() === hostDocument.toLowerCase()
      : actual === hostDocument;
  }
  const devServer = app?.isPackaged
    ? undefined
    : process.env.VITE_DEV_SERVER_URL;
  if (!devServer) return false;
  try {
    const parsed = new URL(url);
    const hostDocument = new URL('plugin-host/index.html', devServer);
    return (
      parsed.origin === hostDocument.origin &&
      parsed.pathname === hostDocument.pathname
    );
  } catch {
    return false;
  }
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
    // Error pages carry the frame policy too; a frame never shows a
    // document without it.
    return withPluginCsp(new Response('Forbidden', { status: 403 }));
  }
  return withPluginCsp(await net.fetch(pathToFileURL(file).toString()));
}
