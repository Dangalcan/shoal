import { shell } from 'electron';

/**
 * Parses a URL that may be handed to the system browser. Only http(s) is
 * accepted: never file:, javascript:, or arbitrary custom schemes.
 * Throws on anything else.
 */
export function assertExternalUrl(url: unknown): URL {
  let parsed: URL;
  try {
    parsed = new URL(String(url));
  } catch {
    throw new Error(`Invalid URL: "${String(url)}"`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Refusing to open non-http(s) URL: "${String(url)}"`);
  }
  return parsed;
}

/** Opens an http(s) URL in the system browser; throws for anything else. */
export async function openExternalSafe(url: unknown): Promise<void> {
  const parsed = assertExternalUrl(url);
  await shell.openExternal(parsed.toString());
}
