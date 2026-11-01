import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MenuItemConstructorOptions } from 'electron';

vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => '1.2.3'),
    isPackaged: true,
    setAboutPanelOptions: vi.fn(),
  },
  Menu: {
    buildFromTemplate: vi.fn((template: unknown) => template),
    setApplicationMenu: vi.fn(),
  },
  shell: { openPath: vi.fn(async () => '') },
}));
vi.mock('../logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  getLogsDirectory: vi.fn(() => '/logs/dir'),
}));
vi.mock('../utils/url-utils', () => ({
  openExternalSafe: vi.fn(async () => undefined),
}));

import { app, Menu, shell } from 'electron';
import log from '../logger';
import { openExternalSafe } from '../utils/url-utils';
import {
  buildMenuTemplate,
  installApplicationMenu,
  openLogsFolder,
  NEW_ISSUE_URL,
  USER_GUIDE_URL,
} from '../menu';
import { REPO_URL } from '../constants';

type Item = MenuItemConstructorOptions;

function submenu(template: Item[], match: (item: Item) => boolean): Item[] {
  const item = template.find(match);
  if (!item || !Array.isArray(item.submenu)) throw new Error('menu not found');
  return item.submenu;
}

function click(items: Item[], label: string): void {
  const item = items.find((i) => i.label === label);
  if (!item?.click) throw new Error(`no clickable item "${label}"`);
  item.click(undefined as never, undefined as never, undefined as never);
}

describe('buildMenuTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps developer tools out of installed builds', () => {
    const packaged = buildMenuTemplate({ isPackaged: true, platform: 'win32' });
    const view = submenu(packaged, (i) => i.label === 'View');
    expect(view.map((i) => i.role)).not.toContain('toggleDevTools');
    expect(view.map((i) => i.role)).toEqual(
      expect.arrayContaining([
        'reload',
        'zoomIn',
        'zoomOut',
        'resetZoom',
        'togglefullscreen',
      ])
    );

    const dev = buildMenuTemplate({ isPackaged: false, platform: 'linux' });
    expect(
      submenu(dev, (i) => i.label === 'View').map((i) => i.role)
    ).toContain('toggleDevTools');
  });

  it('adds the application menu only on macOS', () => {
    expect(
      buildMenuTemplate({ isPackaged: true, platform: 'darwin' })[0].role
    ).toBe('appMenu');
    expect(
      buildMenuTemplate({ isPackaged: true, platform: 'win32' })[0].role
    ).toBe('fileMenu');
  });

  it('opens the guide, the issue form and the repository in the browser', () => {
    const help = submenu(
      buildMenuTemplate({ isPackaged: true, platform: 'win32' }),
      (i) => i.role === 'help'
    );
    click(help, 'User Guide');
    click(help, 'Report an Issue');
    click(help, 'Shoal on GitHub');
    expect(vi.mocked(openExternalSafe).mock.calls.map((c) => c[0])).toEqual([
      USER_GUIDE_URL,
      NEW_ISSUE_URL,
      REPO_URL,
    ]);
    expect(help.some((i) => i.role === 'about')).toBe(true);
  });

  it('opens the logs folder and reports a failure to the log', async () => {
    const help = submenu(
      buildMenuTemplate({ isPackaged: true, platform: 'win32' }),
      (i) => i.role === 'help'
    );
    click(help, 'Open Logs Folder');
    expect(shell.openPath).toHaveBeenCalledWith('/logs/dir');

    vi.mocked(shell.openPath).mockResolvedValueOnce('no file manager');
    openLogsFolder();
    await Promise.resolve();
    await Promise.resolve();
    expect(log.warn).toHaveBeenCalledWith(
      '[Menu] Could not open the logs folder:',
      'no file manager'
    );
  });

  it('logs when the browser cannot be opened', async () => {
    vi.mocked(openExternalSafe).mockRejectedValueOnce(new Error('blocked'));
    const help = submenu(
      buildMenuTemplate({ isPackaged: true, platform: 'win32' }),
      (i) => i.role === 'help'
    );
    click(help, 'User Guide');
    await Promise.resolve();
    await Promise.resolve();
    expect(log.warn).toHaveBeenCalledWith(
      `[Menu] Could not open ${USER_GUIDE_URL}:`,
      'blocked'
    );
  });
});

describe('installApplicationMenu', () => {
  it('fills the About box and installs the menu', () => {
    installApplicationMenu('/icons/icon.png');
    expect(app.setAboutPanelOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationName: 'Shoal',
        applicationVersion: '1.2.3',
        website: REPO_URL,
        iconPath: '/icons/icon.png',
      })
    );
    expect(Menu.buildFromTemplate).toHaveBeenCalledTimes(1);
    expect(Menu.setApplicationMenu).toHaveBeenCalledTimes(1);
  });

  it('leaves the About icon to Electron when none is given', () => {
    vi.mocked(app.setAboutPanelOptions).mockClear();

    installApplicationMenu();

    const options = vi.mocked(app.setAboutPanelOptions).mock.calls[0][0];
    expect(options).toMatchObject({ applicationName: 'Shoal' });
    expect(options).not.toHaveProperty('iconPath');
  });
});

describe('openLogsFolder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs when the file manager call itself fails', async () => {
    vi.mocked(shell.openPath).mockRejectedValueOnce(new Error('no shell'));

    openLogsFolder();
    await vi.waitFor(() =>
      expect(log.warn).toHaveBeenCalledWith(
        '[Menu] Could not open the logs folder:',
        'no shell'
      )
    );
  });

  it('stays quiet when the folder opens', async () => {
    vi.mocked(shell.openPath).mockResolvedValueOnce('');

    openLogsFolder();
    await Promise.resolve();
    await Promise.resolve();

    expect(shell.openPath).toHaveBeenCalledWith('/logs/dir');
    expect(log.warn).not.toHaveBeenCalled();
  });
});
