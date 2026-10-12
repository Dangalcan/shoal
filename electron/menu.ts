/**
 * Application menu
 *
 * Hidden behind Alt (the window sets autoHideMenuBar), but its accelerators
 * always work: zoom, full screen, reload, and a Help menu that opens the
 * user guide, a new GitHub issue, the logs folder and the About box.
 */

import { app, Menu, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import log, { getLogsDirectory } from './logger';
import { openExternalSafe } from './utils/url-utils';
import { getErrorMessage } from './utils/error-utils';
import { REPO_URL } from './constants';

export const USER_GUIDE_URL = `${REPO_URL}/blob/master/docs/USER_GUIDE.md`;
export const NEW_ISSUE_URL = `${REPO_URL}/issues/new/choose`;

export interface MenuOptions {
  /** Developer tools stay out of the menu in installed builds. */
  isPackaged: boolean;
  platform: NodeJS.Platform;
}

function openUrl(url: string): void {
  openExternalSafe(url).catch((error: unknown) =>
    log.warn(`[Menu] Could not open ${url}:`, getErrorMessage(error))
  );
}

/** Opens the folder that holds main.log in the system file manager. */
export function openLogsFolder(): void {
  shell
    .openPath(getLogsDirectory())
    .then((error) => {
      // shell.openPath resolves with an error message instead of throwing.
      if (error) log.warn('[Menu] Could not open the logs folder:', error);
    })
    .catch((error: unknown) =>
      log.warn('[Menu] Could not open the logs folder:', getErrorMessage(error))
    );
}

export function buildMenuTemplate({
  isPackaged,
  platform,
}: MenuOptions): MenuItemConstructorOptions[] {
  const view: MenuItemConstructorOptions[] = [
    { role: 'reload' },
    { role: 'forceReload' },
    ...(isPackaged
      ? []
      : [{ role: 'toggleDevTools' } as MenuItemConstructorOptions]),
    { type: 'separator' },
    { role: 'resetZoom' },
    { role: 'zoomIn' },
    { role: 'zoomOut' },
    { type: 'separator' },
    { role: 'togglefullscreen' },
  ];

  const help: MenuItemConstructorOptions[] = [
    { label: 'User Guide', click: () => openUrl(USER_GUIDE_URL) },
    { label: 'Report an Issue', click: () => openUrl(NEW_ISSUE_URL) },
    { label: 'Shoal on GitHub', click: () => openUrl(REPO_URL) },
    { type: 'separator' },
    { label: 'Open Logs Folder', click: () => openLogsFolder() },
    { type: 'separator' },
    { role: 'about', label: 'About Shoal' },
  ];

  return [
    ...(platform === 'darwin'
      ? [{ role: 'appMenu' } as MenuItemConstructorOptions]
      : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { label: 'View', submenu: view },
    { role: 'windowMenu' },
    { role: 'help', submenu: help },
  ];
}

/** Builds the menu for this platform and build, and fills the About box. */
export function installApplicationMenu(iconPath?: string): void {
  app.setAboutPanelOptions({
    applicationName: 'Shoal',
    applicationVersion: app.getVersion(),
    copyright:
      'Copyright (C) 2026 Daniel Galván Cancio and the Shoal contributors. ' +
      'Free software under the LGPL-3.0-or-later.',
    website: REPO_URL,
    ...(iconPath ? { iconPath } : {}),
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      buildMenuTemplate({
        isPackaged: app.isPackaged,
        platform: process.platform,
      })
    )
  );
}
