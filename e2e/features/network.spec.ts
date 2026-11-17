import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { launchApp, mainWindow } from '../fixtures/launch';
import { EMPTY_KUBECONFIG, writeKubeconfig } from '../fixtures/kubeconfig';

/**
 * What Shoal itself sends over the network. The README says nothing leaves
 * the machine except the update check against GitHub Releases, so this reads
 * Chromium's own net log of a first run: every host a request went to, and
 * the headers of the update check. It covers the app's network stack
 * (renderer, plugin frames, updater), not the tools Shoal runs for you:
 * kubectl talks to your clusters by itself.
 *
 * No cluster and no kubectl are needed. A dev build makes no request at all;
 * the installed app and the AppImage ask GitHub Releases for the latest
 * version.
 */

/** GitHub Releases: the release feed and the files it redirects to. */
const ALLOWED_HOSTS = [/^github\.com$/, /\.githubusercontent\.com$/];
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** Hosts of every http(s) and WebSocket request recorded in a net log. */
function requestedHosts(netLog: string): string[] {
  const hosts = new Set<string>();
  for (const match of netLog.matchAll(/"url":"((?:https?|wss?):\/\/[^"]+)"/g)) {
    hosts.add(new URL(match[1]).hostname);
  }
  return [...hosts].sort();
}

test.describe('network on a first run', () => {
  let log = '';
  let dir = '';

  test.beforeAll(async () => {
    const kubeconfig = writeKubeconfig('network', EMPTY_KUBECONFIG);
    dir = kubeconfig.dir;
    const netLog = path.join(dir, 'net-log.json');
    // Polish stands for any display language the system cannot spell-check:
    // that is when Chromium went looking for a dictionary on Windows. On
    // Linux it did so for every language.
    const app = await launchApp({
      env: { KUBECONFIG: kubeconfig.file },
      args: [`--log-net-log=${netLog}`, '--lang=pl'],
    });
    try {
      const window = await mainWindow(app);
      // A session created after start-up, as electron-updater makes one for
      // its requests: each session starts a spell checker of its own, and a
      // dev build never runs the updater.
      await app.evaluate(({ session }) => {
        session.fromPartition('network-spec', { cache: false });
      });
      await window.getByRole('link', { name: 'Settings' }).click();
      const field = window.locator('input[type="text"]:visible').first();
      await field.click();
      await field.pressSequentially('mispeled wrods');
      await window.getByRole('link', { name: 'Terminal' }).click();
      await window.getByRole('link', { name: 'Plugins' }).click();
      // Time for the update check, and for anything else, to leave.
      await window.waitForTimeout(8000);
    } finally {
      // A normal quit: Chromium only writes the events out when it closes
      // the log itself.
      await app.close();
    }
    log = fs.readFileSync(netLog, 'utf8');
  });

  test.afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('contacts nothing but GitHub Releases', () => {
    expect(log).toContain('"constants"');
    const unexpected = requestedHosts(log).filter(
      (host) => !ALLOWED_HOSTS.some((allowed) => allowed.test(host))
    );
    expect(unexpected).toEqual([]);
  });

  test('the update check does not identify the install', () => {
    test.skip(
      !process.env.SHOAL_E2E_EXECUTABLE,
      'a dev build never checks for updates'
    );
    // electron-updater's own value is a random UUID kept in the profile.
    const ids = [...log.matchAll(/x-user-staging-id: ([^"\\]+)/gi)].map(
      (match) => match[1]
    );
    expect([...new Set(ids)].filter((id) => id !== NIL_UUID)).toEqual([]);
  });
});
