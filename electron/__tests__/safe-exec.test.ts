import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
}));

// execFile is promisified inside safe-exec; the promisified form invokes the
// callback style. Provide a callback-style mock.
vi.mock('child_process', () => ({
  execFile: mocks.execFile,
  default: { execFile: mocks.execFile },
}));

import { safeExec, ALLOWED_TOOLS } from '../utils/safe-exec';

describe('safeExec', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.execFile.mockImplementation(
      (
        _file: string,
        _args: string[],
        _opts: unknown,
        cb: (
          err: Error | null,
          result: { stdout: string; stderr: string }
        ) => void
      ) => {
        cb(null, { stdout: 'ok', stderr: '' });
      }
    );
  });

  it('runs an allowlisted tool with an argument array', async () => {
    const { stdout } = await safeExec('kubectl', ['get', 'pods']);
    expect(stdout).toBe('ok');
    expect(mocks.execFile).toHaveBeenCalledWith(
      'kubectl',
      ['get', 'pods'],
      expect.objectContaining({ shell: false, windowsHide: true }),
      expect.any(Function)
    );
  });

  it('rejects tools not on the allowlist', async () => {
    await expect(safeExec('bash', ['-c', 'rm -rf /'])).rejects.toThrow(
      'Tool not allowed'
    );
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  it('never runs a shell — metacharacters are inert as literal args', async () => {
    // The whole point: this string is a single argv element, not parsed by a shell.
    await safeExec('kubectl', ['get', 'pods; rm -rf /']);
    expect(mocks.execFile).toHaveBeenCalledWith(
      'kubectl',
      ['get', 'pods; rm -rf /'],
      expect.objectContaining({ shell: false }),
      expect.any(Function)
    );
  });

  it('rejects non-string arguments', async () => {
    await expect(
      safeExec('kubectl', ['get', 42 as unknown as string])
    ).rejects.toThrow('Invalid argument');
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  const failWith = (error: Record<string, unknown>) =>
    mocks.execFile.mockImplementation(
      (
        _file: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, result: unknown) => void
      ) => {
        cb(Object.assign(new Error(String(error.message ?? 'failed')), error), {
          stdout: '',
          stderr: String(error.stderr ?? ''),
        });
      }
    );

  it('says a tool is missing instead of "spawn ENOENT"', async () => {
    failWith({ code: 'ENOENT', message: 'spawn kubectl ENOENT' });
    await expect(safeExec('kubectl', ['version'])).rejects.toThrow(
      'kubectl is not installed or not on the PATH'
    );
  });

  it('reports the first line of stderr instead of the whole command line', async () => {
    failWith({
      code: 1,
      message:
        'Command failed: kubectl get pods --context kind-dev -A -o json\nerror: context "kind-dev" does not exist\nmore',
      stderr: 'error: context "kind-dev" does not exist\nmore',
    });
    await expect(
      safeExec('kubectl', ['get', 'pods', '--context', 'kind-dev'])
    ).rejects.toThrow('kubectl: error: context "kind-dev" does not exist');
  });

  it('names a timeout', async () => {
    failWith({ killed: true, signal: 'SIGTERM', message: 'killed' });
    await expect(
      safeExec('kubectl', ['get', 'pods'], { timeout: 10 })
    ).rejects.toThrow('kubectl did not answer in time');
  });

  it('keeps an error without stderr as it is', async () => {
    failWith({ code: 1, message: 'Command failed: kubectl version' });
    await expect(safeExec('kubectl', ['version'])).rejects.toThrow(
      'Command failed: kubectl version'
    );
  });

  it('exposes the shared tool allowlist', () => {
    expect(ALLOWED_TOOLS.has('kubectl')).toBe(true);
    expect(ALLOWED_TOOLS.has('bash')).toBe(false);
  });
});
