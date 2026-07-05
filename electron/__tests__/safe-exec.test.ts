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

  it('exposes the shared tool allowlist', () => {
    expect(ALLOWED_TOOLS.has('kubectl')).toBe(true);
    expect(ALLOWED_TOOLS.has('bash')).toBe(false);
  });
});
