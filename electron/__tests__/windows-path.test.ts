import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
  existsSync: vi.fn(() => true),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('child_process', () => ({
  execFile: mocks.execFile,
  default: { execFile: mocks.execFile },
}));
vi.mock('fs', () => ({
  existsSync: mocks.existsSync,
  default: { existsSync: mocks.existsSync },
}));
vi.mock('../logger', () => ({ default: mocks.log }));

import {
  parseRegPathOutput,
  expandWindowsEnv,
  mergeWindowsPath,
  refreshWindowsPath,
  _resetWindowsPathThrottle,
} from '../utils/windows-path';

const REG_SZ_OUTPUT = `
HKEY_CURRENT_USER\\Environment
    Path    REG_EXPAND_SZ    %USERPROFILE%\\go\\bin;C:\\Users\\ana\\AppData\\Local\\Microsoft\\WinGet\\Links

`;

/** Callback-style execFile stub answering each reg query in order. */
function answerReg(outputs: Array<string | Error>) {
  let i = 0;
  mocks.execFile.mockImplementation(
    (
      _file: string,
      _args: string[],
      _opts: unknown,
      cb: (
        err: Error | null,
        result?: { stdout: string; stderr: string }
      ) => void
    ) => {
      const out = outputs[i++] ?? '';
      if (out instanceof Error) cb(out);
      else cb(null, { stdout: out, stderr: '' });
    }
  );
}

describe('parseRegPathOutput', () => {
  it('reads REG_SZ and REG_EXPAND_SZ values', () => {
    expect(parseRegPathOutput(REG_SZ_OUTPUT)).toBe(
      '%USERPROFILE%\\go\\bin;C:\\Users\\ana\\AppData\\Local\\Microsoft\\WinGet\\Links'
    );
    expect(parseRegPathOutput('    Path    REG_SZ    C:\\tools\\bin\r\n')).toBe(
      'C:\\tools\\bin'
    );
  });

  it('returns null when the value is missing or the query failed', () => {
    expect(parseRegPathOutput('')).toBeNull();
    expect(
      parseRegPathOutput(
        'ERROR: The system was unable to find the specified registry key or value.'
      )
    ).toBeNull();
  });
});

describe('expandWindowsEnv', () => {
  it('expands %VAR% case-insensitively and keeps unknown names', () => {
    const env = { UserProfile: 'C:\\Users\\ana', ProgramFiles: 'C:\\PF' };
    expect(
      expandWindowsEnv('%USERPROFILE%\\go\\bin;%programfiles%\\X', env)
    ).toBe('C:\\Users\\ana\\go\\bin;C:\\PF\\X');
    expect(expandWindowsEnv('%NOPE%\\bin', env)).toBe('%NOPE%\\bin');
  });
});

describe('mergeWindowsPath', () => {
  const env = { USERPROFILE: 'C:\\Users\\ana' };

  it('appends new existing folders after the current entries', () => {
    const merged = mergeWindowsPath(
      'C:\\Windows\\System32;C:\\kube',
      ['%USERPROFILE%\\go\\bin;C:\\kube;C:\\docker\\bin'],
      env,
      () => true
    );
    expect(merged).toBe(
      'C:\\Windows\\System32;C:\\kube;C:\\Users\\ana\\go\\bin;C:\\docker\\bin'
    );
  });

  it('compares folders case-insensitively and without trailing slashes', () => {
    const merged = mergeWindowsPath(
      'C:\\Tools\\Bin',
      ['c:\\tools\\bin\\;C:\\Other'],
      env,
      () => true
    );
    expect(merged).toBe('C:\\Tools\\Bin;C:\\Other');
  });

  it('skips folders that do not exist, are blank or are not fully expanded', () => {
    const merged = mergeWindowsPath(
      'C:\\a',
      ['C:\\missing;;%NOPE%\\bin;C:\\present'],
      env,
      (dir) => dir === 'C:\\present'
    );
    expect(merged).toBe('C:\\a;C:\\present');
  });

  it('leaves an empty PATH plus no registry values empty', () => {
    expect(mergeWindowsPath('', [], env, () => true)).toBe('');
  });
});

describe('refreshWindowsPath', () => {
  const originalPath = process.env.PATH;
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetWindowsPathThrottle();
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });
    process.env.PATH = 'C:\\Windows\\System32';
    process.env.USERPROFILE = 'C:\\Users\\ana';
    mocks.existsSync.mockReturnValue(true);
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
    process.env.PATH = originalPath;
  });

  it('queries both hives with fixed arguments and extends PATH', async () => {
    answerReg([
      REG_SZ_OUTPUT,
      '    Path    REG_SZ    C:\\Program Files\\Docker\\Docker\\resources\\bin\r\n',
    ]);

    await refreshWindowsPath(() => 10_000);

    expect(mocks.execFile).toHaveBeenCalledTimes(2);
    expect(mocks.execFile.mock.calls[0][0]).toMatch(/System32[\\/]reg\.exe$/i);
    expect(mocks.execFile.mock.calls[0][1]).toEqual([
      'query',
      'HKCU\\Environment',
      '/v',
      'Path',
    ]);
    expect(mocks.execFile.mock.calls[1][1]).toEqual([
      'query',
      'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment',
      '/v',
      'Path',
    ]);
    expect(mocks.execFile.mock.calls[0][2]).toMatchObject({ shell: false });
    expect(process.env.PATH).toBe(
      'C:\\Windows\\System32;C:\\Users\\ana\\go\\bin;C:\\Users\\ana\\AppData\\Local\\Microsoft\\WinGet\\Links;C:\\Program Files\\Docker\\Docker\\resources\\bin'
    );
    expect(mocks.log.info).toHaveBeenCalled();
  });

  it('reads the registry at most once per interval', async () => {
    answerReg([REG_SZ_OUTPUT, '']);
    await refreshWindowsPath(() => 10_000);
    await refreshWindowsPath(() => 12_000);
    expect(mocks.execFile).toHaveBeenCalledTimes(2);

    await refreshWindowsPath(() => 20_000);
    expect(mocks.execFile).toHaveBeenCalledTimes(4);
  });

  it('shares one registry read between concurrent callers', async () => {
    answerReg([REG_SZ_OUTPUT, '']);
    await Promise.all([
      refreshWindowsPath(() => 10_000),
      refreshWindowsPath(() => 10_000),
      refreshWindowsPath(() => 10_000),
    ]);
    expect(mocks.execFile).toHaveBeenCalledTimes(2);
  });

  it('leaves PATH alone and never throws when reg fails', async () => {
    answerReg([new Error('reg blocked'), new Error('reg blocked')]);

    await expect(refreshWindowsPath(() => 10_000)).resolves.toBeUndefined();

    expect(process.env.PATH).toBe('C:\\Windows\\System32');
    expect(mocks.log.warn).toHaveBeenCalled();
  });

  it('does nothing off Windows', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      configurable: true,
    });
    await refreshWindowsPath(() => 10_000);
    expect(mocks.execFile).not.toHaveBeenCalled();
  });
});
