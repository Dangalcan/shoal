/**
 * SignatureService with real crypto and real plugin directories: a test key
 * pair stands in for the Shoal key through the MARKETPLACE_PUBLIC_KEY
 * override, and plugins are signed with scripts/sign-plugin.js itself, so the
 * script and the verifier cannot drift apart unnoticed.
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from 'vitest';
import { createRequire } from 'module';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const electronMock = vi.hoisted(() => ({ app: { isPackaged: false } }));
vi.mock('electron', () => electronMock);

import {
  NO_SIGNATURE,
  SignatureService,
  describeSignatureProblem,
} from '../services/security/signature-service';
import log from '../logger';

interface SignScript {
  signPlugin: (dir: string, privateKeyPem: string) => unknown;
}
const { signPlugin } = createRequire(__filename)(
  '../../scripts/sign-plugin.js'
) as SignScript;

let privateKey: string;
let publicKeyEscaped: string;

beforeAll(() => {
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  privateKey = pair.privateKey
    .export({ type: 'pkcs8', format: 'pem' })
    .toString();
  publicKeyEscaped = pair.publicKey
    .export({ type: 'spki', format: 'pem' })
    .toString()
    .replace(/\n/g, '\\n');
});

describe('SignatureService', () => {
  let dir: string;
  const service = new SignatureService();

  beforeEach(() => {
    electronMock.app.isPackaged = false;
    vi.stubEnv('MARKETPLACE_PUBLIC_KEY', publicKeyEscaped);
    vi.stubEnv('ALLOW_UNSIGNED_PLUGINS', '');
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-sig-'));
    fs.writeFileSync(path.join(dir, 'plugin.json'), '{"id":"demo"}\n');
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};\n');
    fs.mkdirSync(path.join(dir, 'data'));
    fs.writeFileSync(path.join(dir, 'data', 'config.json'), '{}\n');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const write = (rel: string, text: string) =>
    fs.writeFileSync(path.join(dir, rel), text);

  it('accepts a plugin signed by the script', async () => {
    signPlugin(dir, privateKey);
    expect(await service.verifyPlugin(dir)).toBe(true);
  });

  it('rejects a plugin whose code changed after signing', async () => {
    signPlugin(dir, privateKey);
    write('index.js', 'require("child_process").exec("evil");\n');
    expect(await service.verifyPlugin(dir)).toBe(false);
  });

  it('rejects a plugin with an extra file', async () => {
    signPlugin(dir, privateKey);
    write('extra.js', '1;\n');
    expect(await service.verifyPlugin(dir)).toBe(false);
  });

  it('rejects a plugin with a missing file', async () => {
    signPlugin(dir, privateKey);
    fs.rmSync(path.join(dir, 'data', 'config.json'));
    expect(await service.verifyPlugin(dir)).toBe(false);
  });

  it('rejects a file list signed with another key', async () => {
    const other = crypto
      .generateKeyPairSync('rsa', { modulusLength: 2048 })
      .privateKey.export({ type: 'pkcs8', format: 'pem' })
      .toString();
    signPlugin(dir, other);
    expect(await service.verifyPlugin(dir)).toBe(false);
  });

  it('rejects a tampered file list even when the files match it', async () => {
    signPlugin(dir, privateKey);
    write('index.js', 'evil();\n');
    const sigPath = path.join(dir, 'plugin.json.sig');
    const sig = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    sig.files['index.js'] = crypto
      .createHash('sha256')
      .update('evil();\n')
      .digest('hex');
    fs.writeFileSync(sigPath, JSON.stringify(sig));
    expect(await service.verifyPlugin(dir)).toBe(false);
  });

  it('rejects a plugin containing a symbolic link', async (ctx) => {
    try {
      fs.symlinkSync(os.homedir(), path.join(dir, 'link'), 'junction');
    } catch {
      ctx.skip(); // no symlink rights on this machine
    }
    expect(await service.verifyPlugin(dir)).toBe(false);
  });

  it('rejects the old manifest-only signature format', async () => {
    const manifest = fs.readFileSync(path.join(dir, 'plugin.json'));
    write(
      'plugin.json.sig',
      crypto.sign('sha256', manifest, privateKey).toString('hex')
    );
    expect(await service.verifyPlugin(dir)).toBe(false);
  });

  it('says why a plugin was refused, without calling unsigned plugins tampered', async () => {
    expect(await service.checkPlugin(dir)).toEqual({
      ok: false,
      problem: NO_SIGNATURE,
    });
    const unsigned = describeSignatureProblem(NO_SIGNATURE);
    expect(unsigned).toContain('not signed');
    expect(unsigned).toContain('npm run dev');

    signPlugin(dir, privateKey);
    write('index.js', 'changed();\n');
    const changed = await service.checkPlugin(dir);
    expect(changed.ok).toBe(false);
    if (!changed.ok) {
      expect(changed.problem).toContain('modified index.js');
      expect(describeSignatureProblem(changed.problem)).toContain(
        'do not match its signature'
      );
    }
  });

  it('rejects an unsigned plugin by default', async () => {
    expect(await service.verifyPlugin(dir)).toBe(false);
  });

  it('loads unsigned or edited plugins in development with ALLOW_UNSIGNED_PLUGINS', async () => {
    vi.stubEnv('ALLOW_UNSIGNED_PLUGINS', 'true');
    expect(await service.verifyPlugin(dir)).toBe(true);

    signPlugin(dir, privateKey);
    write('index.js', 'edited();\n');
    expect(await service.verifyPlugin(dir)).toBe(true);
  });

  it('ignores ALLOW_UNSIGNED_PLUGINS in packaged builds', async () => {
    vi.stubEnv('ALLOW_UNSIGNED_PLUGINS', 'true');
    electronMock.app.isPackaged = true;
    expect(await service.verifyPlugin(dir)).toBe(false);
  });

  it('falls back to the embedded key when MARKETPLACE_PUBLIC_KEY is not a PEM', async () => {
    vi.stubEnv('MARKETPLACE_PUBLIC_KEY', 'not-a-pem');
    signPlugin(dir, privateKey);
    // Signed with the test key, checked against the embedded Shoal key.
    expect(await service.verifyPlugin(dir)).toBe(false);
  });

  it('ignores MARKETPLACE_PUBLIC_KEY in packaged builds', async () => {
    electronMock.app.isPackaged = true;
    signPlugin(dir, privateKey);
    // Signed with the override key, which an installed build must not trust:
    // the environment would otherwise replace the plugin signing key.
    expect(await service.verifyPlugin(dir)).toBe(false);
  });

  it('warns only once that MARKETPLACE_PUBLIC_KEY is ignored in packaged builds', async () => {
    electronMock.app.isPackaged = true;
    const packaged = new SignatureService();
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(log, 'error').mockImplementation(() => {});
    signPlugin(dir, privateKey);
    try {
      expect(await packaged.verifyPlugin(dir)).toBe(false);
      expect(await packaged.verifyPlugin(dir)).toBe(false);
      const ignored = warn.mock.calls.filter(([message]) =>
        String(message).includes('MARKETPLACE_PUBLIC_KEY is ignored')
      );
      expect(ignored).toHaveLength(1);
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });

  it('reports an unreadable verification key as an invalid signature', async () => {
    vi.stubEnv(
      'MARKETPLACE_PUBLIC_KEY',
      '-----BEGIN PUBLIC KEY-----\nnot-a-key\n-----END PUBLIC KEY-----'
    );
    const error = vi.spyOn(log, 'error').mockImplementation(() => {});
    signPlugin(dir, privateKey);
    try {
      expect(await service.checkPlugin(dir)).toEqual({
        ok: false,
        problem: 'invalid signature',
      });
      expect(error).toHaveBeenCalledWith(
        '[SignatureService] Signature check failed:',
        expect.any(Error)
      );
    } finally {
      error.mockRestore();
    }
  });
});
