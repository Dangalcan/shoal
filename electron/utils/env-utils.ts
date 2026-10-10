import { app } from 'electron';

/**
 * Returns true when running in a packaged (production) Electron build.
 * Use this instead of scattering `app?.isPackaged` checks throughout services.
 */
export function isProduction(): boolean {
  return app?.isPackaged ?? false;
}

/**
 * The plugin marketplace (catalog, installs, checkout, licenses, update
 * checks) is off unless MARKETPLACE_ENABLED=true. The 0.9 beta ships without
 * it; `npm run dev` turns it on against the local backend.
 */
export function isMarketplaceEnabled(): boolean {
  return process.env.MARKETPLACE_ENABLED === 'true';
}

export const MARKETPLACE_DISABLED_MESSAGE =
  'The marketplace is not available in this version';

/** Throws when the marketplace is disabled. Meant for IPC handlers. */
export function assertMarketplaceEnabled(): void {
  if (!isMarketplaceEnabled()) {
    throw new Error(MARKETPLACE_DISABLED_MESSAGE);
  }
}
