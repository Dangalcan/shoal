import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/safe-exec', () => ({
  safeExec: vi.fn(),
  ALLOWED_TOOLS: new Set([
    'kubectl',
    'helm',
    'kind',
    'k3d',
    'docker',
    'podman',
  ]),
}));

import { safeExec } from '../utils/safe-exec';
import { ToolService } from '../services/tools/tool-service';

const ok = (stdout: string) => ({ stdout, stderr: '' });

describe('ToolService', () => {
  const service = new ToolService();

  beforeEach(() => vi.clearAllMocks());

  it('probes kubectl with "version --client" (kubectl rejects --version)', async () => {
    vi.mocked(safeExec).mockResolvedValueOnce(
      ok('Client Version: v1.31.2\nKustomize Version: v5.4.2\n')
    );

    const status = await service.getToolStatus('kubectl');

    expect(safeExec).toHaveBeenCalledWith(
      'kubectl',
      ['version', '--client'],
      expect.objectContaining({ timeout: 10_000 })
    );
    expect(status).toEqual({
      tool: 'kubectl',
      installed: true,
      version: 'Client Version: v1.31.2',
    });
  });

  it('uses "version" for tools without a specific probe', async () => {
    vi.mocked(safeExec).mockResolvedValueOnce(
      ok('kind v0.24.0 go1.22 linux/amd64')
    );
    await service.getToolStatus('kind');
    expect(safeExec).toHaveBeenCalledWith(
      'kind',
      ['version'],
      expect.anything()
    );
  });

  it('reports a tool that cannot run as not installed', async () => {
    vi.mocked(safeExec).mockRejectedValueOnce(new Error('spawn helm ENOENT'));
    expect(await service.getToolStatus('helm')).toEqual({
      tool: 'helm',
      installed: false,
    });
  });

  it('checks the docker daemon after the CLI', async () => {
    vi.mocked(safeExec)
      .mockResolvedValueOnce(ok('Docker version 27.3.1, build ce12230'))
      .mockResolvedValueOnce(ok('27.3.1'));

    expect(await service.getToolStatus('docker')).toEqual({
      tool: 'docker',
      installed: true,
      version: 'Docker version 27.3.1, build ce12230',
      running: true,
    });
    expect(safeExec).toHaveBeenLastCalledWith(
      'docker',
      ['info', '--format', '{{.ServerVersion}}'],
      expect.anything()
    );
  });

  it('reports an installed engine whose daemon is down as not running', async () => {
    vi.mocked(safeExec)
      .mockResolvedValueOnce(ok('podman version 5.2.0'))
      .mockRejectedValueOnce(new Error('Cannot connect to Podman'));

    expect(await service.getToolStatus('podman')).toMatchObject({
      installed: true,
      running: false,
    });
  });

  it('refuses tools outside the safe-exec allowlist', async () => {
    await expect(service.getToolStatus('rm')).rejects.toThrow(
      'Tool not allowed'
    );
    expect(safeExec).not.toHaveBeenCalled();
  });
});
