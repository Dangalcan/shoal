import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HelmService } from '../services/helm/helm-service';
import { safeExec } from '../utils/safe-exec';
import { promises as fs } from 'fs';

vi.mock('../utils/safe-exec', () => ({
  safeExec: vi.fn(),
  ALLOWED_TOOLS: new Set(['kubectl', 'helm']),
}));

vi.mock('fs', () => {
  const promises = {
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  };
  return { promises, default: { promises } };
});

const mockSafeExec = vi.mocked(safeExec);
const mockWriteFile = vi.mocked(fs.writeFile);
const mockUnlink = vi.mocked(fs.unlink);

/** The args array of the safeExec('helm', args) call at position i. */
function argsOfCall(i: number): string[] {
  const call = mockSafeExec.mock.calls[i];
  return (call?.[1] as string[]) ?? [];
}

const base = {
  contextName: 'kind-test',
  namespace: 'default',
  releaseName: 'my-release',
};

describe('HelmService', () => {
  let service: HelmService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSafeExec.mockResolvedValue({ stdout: 'ok', stderr: '' });
    service = new HelmService();
  });

  describe('install / upgrade', () => {
    it('builds a validated helm install command', async () => {
      await service.install({ ...base, chart: 'bitnami/nginx' });
      expect(mockSafeExec).toHaveBeenCalledWith(
        'helm',
        [
          'install',
          'my-release',
          'bitnami/nginx',
          '--kube-context',
          'kind-test',
          '-n',
          'default',
        ],
        expect.objectContaining({ timeout: expect.any(Number) })
      );
    });

    it('adds --version and --create-namespace when requested', async () => {
      await service.install({
        ...base,
        chart: 'bitnami/nginx',
        version: '1.2.3',
        createNamespace: true,
      });
      const args = argsOfCall(0);
      expect(args).toContain('--version');
      expect(args).toContain('1.2.3');
      expect(args).toContain('--create-namespace');
    });

    it('stages custom values via a temp -f file and cleans it up', async () => {
      await service.upgrade({
        ...base,
        chart: 'bitnami/nginx',
        values: 'replicaCount: 3\n',
      });
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const file = mockWriteFile.mock.calls[0][0] as string;
      const args = argsOfCall(0);
      expect(args[0]).toBe('upgrade');
      expect(args).toContain('-f');
      expect(args).toContain(file);
      expect(mockUnlink).toHaveBeenCalledWith(file);
    });

    it('cleans up the values file even when helm fails', async () => {
      mockSafeExec.mockRejectedValueOnce(new Error('helm exploded'));
      await expect(
        service.install({ ...base, chart: 'x/y', values: 'a: 1\n' })
      ).rejects.toThrow('helm exploded');
      expect(mockUnlink).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['release name', { ...base, releaseName: 'Bad_Name', chart: 'x/y' }],
      ['release name flag', { ...base, releaseName: '--evil', chart: 'x/y' }],
      ['chart ref', { ...base, chart: '--kubeconfig=/evil' }],
      ['chart ref metachars', { ...base, chart: 'a;rm -rf /' }],
      ['version', { ...base, chart: 'x/y', version: '--set=a' }],
      ['namespace', { ...base, namespace: 'NOT_VALID', chart: 'x/y' }],
      ['context', { ...base, contextName: 'bad ctx', chart: 'x/y' }],
    ])('rejects invalid %s', async (_label, args) => {
      await expect(
        service.install(args as Parameters<HelmService['install']>[0])
      ).rejects.toThrow(/Invalid/);
      expect(mockSafeExec).not.toHaveBeenCalled();
    });

    it('rejects the "all" pseudo-namespace', async () => {
      await expect(
        service.install({ ...base, namespace: 'all', chart: 'x/y' })
      ).rejects.toThrow(/concrete namespace/);
    });

    it('rejects oversized values payloads', async () => {
      await expect(
        service.install({
          ...base,
          chart: 'x/y',
          values: 'a'.repeat(1024 * 1024 + 1),
        })
      ).rejects.toThrow(/1 MiB/);
    });

    it('accepts oci chart references', async () => {
      await service.install({
        ...base,
        chart: 'oci://registry.example.com/charts/nginx',
      });
      expect(argsOfCall(0)).toContain(
        'oci://registry.example.com/charts/nginx'
      );
    });
  });

  describe('rollback', () => {
    it('builds a validated rollback command', async () => {
      await service.rollback({ ...base, revision: 4 });
      expect(argsOfCall(0)).toEqual([
        'rollback',
        'my-release',
        '4',
        '--kube-context',
        'kind-test',
        '-n',
        'default',
      ]);
    });

    it.each([0, -1, 1.5, NaN])('rejects revision %s', async (revision) => {
      await expect(service.rollback({ ...base, revision })).rejects.toThrow(
        /Invalid revision/
      );
    });
  });

  describe('uninstall', () => {
    it('builds a validated uninstall command', async () => {
      await service.uninstall(base);
      expect(argsOfCall(0)).toEqual([
        'uninstall',
        'my-release',
        '--kube-context',
        'kind-test',
        '-n',
        'default',
      ]);
    });
  });

  describe('repoAdd', () => {
    it('adds then updates the repo', async () => {
      await service.repoAdd({
        name: 'bitnami',
        url: 'https://charts.bitnami.com/bitnami',
      });
      expect(argsOfCall(0)).toEqual([
        'repo',
        'add',
        'bitnami',
        'https://charts.bitnami.com/bitnami',
      ]);
      expect(argsOfCall(1)).toEqual(['repo', 'update', 'bitnami']);
    });

    it.each([
      ['name', { name: 'Bad Name', url: 'https://x.io' }],
      ['url scheme', { name: 'ok', url: 'file:///etc/passwd' }],
      ['url garbage', { name: 'ok', url: 'not a url' }],
    ])('rejects invalid repo %s', async (_label, args) => {
      await expect(service.repoAdd(args)).rejects.toThrow(/Invalid|http/);
      expect(mockSafeExec).not.toHaveBeenCalled();
    });
  });

  describe('repoList', () => {
    it('parses helm repo list json', async () => {
      mockSafeExec.mockResolvedValueOnce({
        stdout: '[{"name":"bitnami","url":"https://charts.bitnami.com"}]',
        stderr: '',
      });
      const repos = await service.repoList();
      expect(repos).toEqual([
        { name: 'bitnami', url: 'https://charts.bitnami.com' },
      ]);
    });

    it('returns [] when no repositories are configured', async () => {
      mockSafeExec.mockRejectedValueOnce(
        new Error('Error: no repositories to show')
      );
      await expect(service.repoList()).resolves.toEqual([]);
    });

    it.each(['null', '{"name":"bitnami"}'])(
      'returns [] when helm prints %s instead of a list',
      async (stdout) => {
        mockSafeExec.mockResolvedValueOnce({ stdout, stderr: '' });
        await expect(service.repoList()).resolves.toEqual([]);
      }
    );

    it('returns [] for a non-Error rejection about missing repositories', async () => {
      mockSafeExec.mockRejectedValueOnce('Error: no repositories to show');
      await expect(service.repoList()).resolves.toEqual([]);
    });

    it('rethrows any other failure', async () => {
      const failure = new Error('helm: Kubernetes cluster unreachable');
      mockSafeExec.mockRejectedValueOnce(failure);
      await expect(service.repoList()).rejects.toBe(failure);

      mockSafeExec.mockRejectedValueOnce('exit status 1');
      await expect(service.repoList()).rejects.toBe('exit status 1');
    });

    it('rethrows unparseable output', async () => {
      mockSafeExec.mockResolvedValueOnce({ stdout: 'not json', stderr: '' });
      await expect(service.repoList()).rejects.toThrow(SyntaxError);
    });
  });
});
