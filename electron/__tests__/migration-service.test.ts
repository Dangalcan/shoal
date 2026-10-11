import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import { safeExec } from '../utils/safe-exec';
import { MigrationService } from '../services/migration/migration-service';

vi.mock('../logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../utils/safe-exec', () => ({
  safeExec: vi.fn(),
}));

vi.mock('fs/promises', () => {
  const stat = vi.fn();
  const readFile = vi.fn();
  return { default: { stat, readFile }, stat, readFile };
});

const COMPOSE_PATH = 'C:/project/docker-compose.yml';

const COMPOSE_FILE = `
services:
  web:
    image: nginx:latest
    ports:
      - "80:80"
  api:
    build: ./api
    ports:
      - "3000:3000"
`;

const KOMPOSE_STDOUT = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
---
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  ports:
    - port: 80
`;

const KOMPOSE_STDERR =
  "WARN[0000] Service \"api\" won't be created because 'ports' is not specified \n" +
  'INFO[0000] Kubernetes file "web-service.yaml" created \n';

function mockFileOk(size = 512) {
  vi.mocked(fs.stat).mockResolvedValue({
    isFile: () => true,
    size,
  } as Awaited<ReturnType<typeof fs.stat>>);
  vi.mocked(fs.readFile).mockResolvedValue(COMPOSE_FILE);
}

describe('MigrationService', () => {
  let service: MigrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MigrationService();
  });

  describe('checkKompose', () => {
    it('reports the version when kompose is on PATH', async () => {
      vi.mocked(safeExec).mockResolvedValue({
        stdout: '1.34.0 (cbf2835db)\n',
        stderr: '',
      });

      const status = await service.checkKompose();

      expect(status).toEqual({
        available: true,
        version: '1.34.0 (cbf2835db)',
      });
      expect(safeExec).toHaveBeenCalledWith('kompose', ['version'], {
        timeout: 10_000,
      });
    });

    it('reports unavailable when the binary is missing', async () => {
      vi.mocked(safeExec).mockRejectedValue(new Error('ENOENT'));

      const status = await service.checkKompose();

      expect(status).toEqual({ available: false });
    });
  });

  describe('convertComposeFile', () => {
    it('converts a compose file into one manifest per resource', async () => {
      mockFileOk();
      vi.mocked(safeExec).mockResolvedValue({
        stdout: KOMPOSE_STDOUT,
        stderr: KOMPOSE_STDERR,
      });

      const result = await service.convertComposeFile(COMPOSE_PATH);

      expect(safeExec).toHaveBeenCalledWith(
        'kompose',
        [
          'convert',
          '--file',
          COMPOSE_PATH,
          '--stdout',
          '--with-kompose-annotation=false',
        ],
        { timeout: 60_000 }
      );
      expect(result.manifests).toHaveLength(2);
      expect(result.manifests[0]).toMatchObject({
        fileName: 'web-deployment.yaml',
        kind: 'Deployment',
        name: 'web',
      });
      expect(result.manifests[0].content).toContain('kind: Deployment');
      expect(result.manifests[1]).toMatchObject({
        fileName: 'web-service.yaml',
        kind: 'Service',
        name: 'web',
      });
    });

    it('extracts kompose warnings from stderr and ignores info lines', async () => {
      mockFileOk();
      vi.mocked(safeExec).mockResolvedValue({
        stdout: KOMPOSE_STDOUT,
        stderr: KOMPOSE_STDERR,
      });

      const result = await service.convertComposeFile(COMPOSE_PATH);

      expect(result.warnings).toEqual([
        "Service \"api\" won't be created because 'ports' is not specified",
      ]);
    });

    it('flags services with a build key as locally built images', async () => {
      mockFileOk();
      vi.mocked(safeExec).mockResolvedValue({
        stdout: KOMPOSE_STDOUT,
        stderr: '',
      });

      const result = await service.convertComposeFile(COMPOSE_PATH);

      expect(result.locallyBuiltImages).toEqual(['api']);
    });

    it('prefers the image name for locally built services that set one', async () => {
      mockFileOk();
      vi.mocked(fs.readFile).mockResolvedValue(
        'services:\n  api:\n    build: ./api\n    image: myco/api:1.0\n'
      );
      vi.mocked(safeExec).mockResolvedValue({
        stdout: KOMPOSE_STDOUT,
        stderr: '',
      });

      const result = await service.convertComposeFile(COMPOSE_PATH);

      expect(result.locallyBuiltImages).toEqual(['myco/api:1.0']);
    });

    it('follows YAML merge keys when looking for locally built services', async () => {
      mockFileOk();
      vi.mocked(fs.readFile).mockResolvedValue(
        'x-api: &api\n  build: ./api\n  restart: always\n' +
          'services:\n  web:\n    image: nginx:latest\n' +
          '  worker:\n    <<: *api\n    command: work\n'
      );
      vi.mocked(safeExec).mockResolvedValue({
        stdout: KOMPOSE_STDOUT,
        stderr: '',
      });

      const result = await service.convertComposeFile(COMPOSE_PATH);

      expect(result.locallyBuiltImages).toEqual(['worker']);
    });

    it('returns no local images for an empty compose file', async () => {
      mockFileOk();
      vi.mocked(fs.readFile).mockResolvedValue('  \n');
      vi.mocked(safeExec).mockResolvedValue({
        stdout: KOMPOSE_STDOUT,
        stderr: '',
      });

      const result = await service.convertComposeFile(COMPOSE_PATH);

      expect(result.locallyBuiltImages).toEqual([]);
    });

    it('returns no local images when the compose file cannot be re-read', async () => {
      mockFileOk();
      vi.mocked(fs.readFile).mockRejectedValue(new Error('EACCES'));
      vi.mocked(safeExec).mockResolvedValue({
        stdout: KOMPOSE_STDOUT,
        stderr: '',
      });

      const result = await service.convertComposeFile(COMPOSE_PATH);

      expect(result.locallyBuiltImages).toEqual([]);
    });

    it('expands a kind: List wrapper into individual manifests', async () => {
      mockFileOk();
      vi.mocked(safeExec).mockResolvedValue({
        stdout: `
apiVersion: v1
kind: List
items:
  - apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: web
  - apiVersion: v1
    kind: Service
    metadata:
      name: web
`,
        stderr: '',
      });

      const result = await service.convertComposeFile(COMPOSE_PATH);

      expect(result.manifests.map((m) => m.kind)).toEqual([
        'Deployment',
        'Service',
      ]);
    });

    it('rejects files without a yaml extension', async () => {
      await expect(
        service.convertComposeFile('C:/project/compose.txt')
      ).rejects.toThrow(/\.yml or \.yaml/);
      expect(safeExec).not.toHaveBeenCalled();
    });

    it('rejects a path that does not exist', async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

      await expect(service.convertComposeFile(COMPOSE_PATH)).rejects.toThrow(
        /not found/
      );
      expect(safeExec).not.toHaveBeenCalled();
    });

    it('rejects an oversized compose file', async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        size: 2 * 1024 * 1024,
      } as Awaited<ReturnType<typeof fs.stat>>);

      await expect(service.convertComposeFile(COMPOSE_PATH)).rejects.toThrow(
        /too large/
      );
      expect(safeExec).not.toHaveBeenCalled();
    });

    it('rejects when kompose produces no resources', async () => {
      mockFileOk();
      vi.mocked(safeExec).mockResolvedValue({ stdout: '', stderr: '' });

      await expect(service.convertComposeFile(COMPOSE_PATH)).rejects.toThrow(
        /no Kubernetes resources/
      );
    });

    it('rejects when kompose output is not valid YAML', async () => {
      mockFileOk();
      vi.mocked(safeExec).mockResolvedValue({
        stdout: 'kind: Deployment\n\tbad: indent',
        stderr: '',
      });

      await expect(service.convertComposeFile(COMPOSE_PATH)).rejects.toThrow(
        /Failed to parse kompose output/
      );
    });
  });
});
