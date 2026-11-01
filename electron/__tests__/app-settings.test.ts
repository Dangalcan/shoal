import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

let userData = '';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => userData) },
}));
vi.mock('../logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  AppSettingsStore,
  assertKubeconfigPath,
  applySavedKubeconfig,
} from '../services/settings/app-settings';

describe('AppSettingsStore', () => {
  beforeEach(() => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-settings-'));
  });

  afterEach(() => {
    fs.rmSync(userData, { recursive: true, force: true });
  });

  it('starts empty when there is no settings file', async () => {
    expect(await new AppSettingsStore().load()).toEqual({});
  });

  it('ignores a corrupt settings file', async () => {
    fs.writeFileSync(path.join(userData, 'app-settings.json'), '{not json');
    expect(await new AppSettingsStore().load()).toEqual({});
  });

  it('persists updates and drops keys set to undefined', async () => {
    const store = new AppSettingsStore();
    await store.update({ kubeconfigPath: '/home/ana/.kube/config' });
    expect(await new AppSettingsStore().load()).toEqual({
      kubeconfigPath: '/home/ana/.kube/config',
    });

    await store.update({ kubeconfigPath: undefined });
    expect(await new AppSettingsStore().load()).toEqual({});
  });

  it.each(['null', '42', '"text"'])(
    'treats a settings file holding %s as empty',
    async (content) => {
      fs.writeFileSync(path.join(userData, 'app-settings.json'), content);
      expect(await new AppSettingsStore().load()).toEqual({});
    }
  );

  it('get() returns a copy of the loaded settings', async () => {
    fs.writeFileSync(
      path.join(userData, 'app-settings.json'),
      JSON.stringify({ windowMaximized: true })
    );
    const store = new AppSettingsStore();
    expect(store.get()).toEqual({});

    await store.load();
    const settings = store.get();
    expect(settings).toEqual({ windowMaximized: true });

    settings.windowMaximized = false;
    expect(store.get()).toEqual({ windowMaximized: true });
  });
});

describe('assertKubeconfigPath', () => {
  let dir: string;
  let fileA: string;
  let fileB: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-kubeconfig-'));
    fileA = path.join(dir, 'a.yaml');
    fileB = path.join(dir, 'b.yaml');
    fs.writeFileSync(fileA, 'apiVersion: v1');
    fs.writeFileSync(fileB, 'apiVersion: v1');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('accepts one or several existing files', async () => {
    await expect(assertKubeconfigPath(fileA)).resolves.toBeUndefined();
    await expect(
      assertKubeconfigPath([fileA, fileB].join(path.delimiter))
    ).resolves.toBeUndefined();
  });

  it('rejects missing files and directories', async () => {
    await expect(
      assertKubeconfigPath(path.join(dir, 'nope.yaml'))
    ).rejects.toThrow('Kubeconfig file not found');
    await expect(assertKubeconfigPath(dir)).rejects.toThrow(
      'Kubeconfig file not found'
    );
  });

  it('rejects a value with no path in it', async () => {
    await expect(assertKubeconfigPath('')).rejects.toThrow(
      'Kubeconfig path is empty'
    );
    await expect(
      assertKubeconfigPath(path.delimiter + path.delimiter)
    ).rejects.toThrow('Kubeconfig path is empty');
  });
});

describe('applySavedKubeconfig', () => {
  const original = process.env.KUBECONFIG;

  afterEach(() => {
    if (original === undefined) delete process.env.KUBECONFIG;
    else process.env.KUBECONFIG = original;
  });

  it('sets KUBECONFIG only when a path was saved', () => {
    process.env.KUBECONFIG = '/from/the/shell';
    applySavedKubeconfig({});
    expect(process.env.KUBECONFIG).toBe('/from/the/shell');

    applySavedKubeconfig({ kubeconfigPath: '/saved/config' });
    expect(process.env.KUBECONFIG).toBe('/saved/config');
  });
});
