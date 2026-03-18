import { app } from 'electron';

/**
 * Returns true when running in a packaged (production) Electron build.
 * Use this instead of scattering `app?.isPackaged` checks throughout services.
 */
export function isProduction(): boolean {
  return app?.isPackaged ?? false;
}
