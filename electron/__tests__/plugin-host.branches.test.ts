/**
 * PluginHostRuntime edge cases: a plugin that exports nothing usable, a
 * context call refused without an error text, and a watch stopped twice.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PluginHostRuntime } from '../services/plugins/host/plugin-host';
import type {
  HostToMainMessage,
  MainToHostMessage,
} from '../services/plugins/host/host-protocol';

class FakePort {
  sent: HostToMainMessage[] = [];
  private listener: ((message: MainToHostMessage) => void) | null = null;

  postMessage(message: HostToMainMessage): void {
    this.sent.push(message);
  }

  onMessage(listener: (message: MainToHostMessage) => void): void {
    this.listener = listener;
  }

  emit(message: MainToHostMessage): void {
    this.listener?.(message);
  }

  ofType<T extends HostToMainMessage['type']>(
    type: T
  ): Extract<HostToMainMessage, { type: T }>[] {
    return this.sent.filter((m) => m.type === type) as Extract<
      HostToMainMessage,
      { type: T }
    >[];
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const PLUGIN_SOURCE = `
let ctx = null;
exports.activate = (context) => { ctx = context; };
exports.read = async () => {
  try {
    await ctx.kubernetes.getResources('pods', 'default');
    return 'no-throw';
  } catch (error) {
    return error.message;
  }
};
exports.watchAndStopTwice = () => {
  const stop = ctx.kubernetes.watchResources('pods', () => {});
  stop();
  stop();
  return 'stopped';
};
`;

describe('PluginHostRuntime branches', () => {
  let dir: string;
  let port: FakePort;

  const load = (source: string): void => {
    const mainFile = path.join(dir, 'index.js');
    fs.writeFileSync(mainFile, source);
    port.emit({
      type: 'init',
      pluginId: 'edge-plugin',
      pluginPath: dir,
      mainFile,
      permissions: ['kubernetes'],
    });
  };

  const invoke = (id: number, name: string, withContext = false): void => {
    port.emit({ type: 'invoke', id, name, withContext, args: [] });
  };

  const resultFor = (id: number) =>
    port.ofType('invoke-result').find((m) => m.id === id);

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-host-edge-'));
    port = new FakePort();
    new PluginHostRuntime(port, vi.fn());
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('loads a plugin whose module.exports is null with no exports', async () => {
    load('module.exports = null;');

    expect(port.ofType('loaded')).toEqual([{ type: 'loaded', exports: [] }]);
    invoke(1, 'activate', true);
    await flush();
    expect(resultFor(1)).toEqual({
      type: 'invoke-result',
      id: 1,
      ok: false,
      result: undefined,
      error: 'Export "activate" is not a function',
    });
  });

  it('turns a refused context call without an error text into "Unknown error"', async () => {
    load(PLUGIN_SOURCE);
    invoke(1, 'activate', true);
    invoke(2, 'read');
    await flush();

    const call = port
      .ofType('context-call')
      .find((c) => c.path === 'kubernetes.getResources');
    expect(call?.args).toEqual(['pods', 'default']);
    port.emit({ type: 'context-result', id: call!.id, ok: false });
    await flush();

    expect(resultFor(2)).toMatchObject({ ok: true, result: 'Unknown error' });
  });

  it('stopping a watch twice repeats the unsubscribe without failing', async () => {
    load(PLUGIN_SOURCE);
    invoke(1, 'activate', true);
    invoke(2, 'watchAndStopTwice');
    await flush();

    const watch = port
      .ofType('context-call')
      .find((c) => c.path === 'kubernetes.watchResources');
    const cbId = watch!.callbacks![0].cbId;
    expect(port.ofType('unsubscribe')).toEqual([
      { type: 'unsubscribe', cbId },
      { type: 'unsubscribe', cbId },
    ]);
    expect(resultFor(2)).toMatchObject({ ok: true, result: 'stopped' });
  });
});
