/**
 * Branch coverage for MigrationService: input validation, unusual kompose
 * output (empty documents, List items that are not objects, resources
 * without kind or name), logfmt-style warnings and compose services that
 * are declared without a body.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import { safeExec } from '../utils/safe-exec';
import { MigrationService } from '../services/migration/migration-service';

vi.mock('../logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../utils/safe-exec', () => ({
  safeExec: vi.fn(),
}));

vi.mock('fs/promises', () => {
  const stat = vi.fn();
  const readFile = vi.fn();
  return { default: { stat, readFile }, stat, readFile };
});

const COMPOSE_PATH = '/project/docker-compose.yaml';

const DEPLOYMENT = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
`;

function mockFile(compose = 'services:\n  web:\n    image: nginx\n') {
  vi.mocked(fs.stat).mockResolvedValue({
    isFile: () => true,
    size: 128,
  } as Awaited<ReturnType<typeof fs.stat>>);
  vi.mocked(fs.readFile).mockResolvedValue(compose);
}

function komposeAnswers(stdout: string, stderr = '') {
  vi.mocked(safeExec).mockResolvedValue({ stdout, stderr });
}

describe('MigrationService (branches)', () => {
  let service: MigrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MigrationService();
  });

  describe('compose file validation', () => {
    it.each([
      ['an empty path', ''],
      ['a blank path', '   '],
      ['a non-string path', 42 as unknown as string],
    ])('rejects %s before touching the disk', async (_label, filePath) => {
      await expect(service.convertComposeFile(filePath)).rejects.toThrow(
        'Compose file path is required'
      );
      expect(fs.stat).not.toHaveBeenCalled();
      expect(safeExec).not.toHaveBeenCalled();
    });

    it('accepts the extension in any case', async () => {
      mockFile();
      komposeAnswers(DEPLOYMENT);

      const result = await service.convertComposeFile('/project/COMPOSE.YML');

      expect(result.manifests).toHaveLength(1);
    });

    it('rejects a path that is a directory', async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => false,
        size: 0,
      } as Awaited<ReturnType<typeof fs.stat>>);

      await expect(service.convertComposeFile(COMPOSE_PATH)).rejects.toThrow(
        `Not a file: ${COMPOSE_PATH}`
      );
      expect(safeExec).not.toHaveBeenCalled();
    });
  });

  describe('kompose output parsing', () => {
    it('skips empty and scalar YAML documents', async () => {
      mockFile();
      komposeAnswers(`---\n---\njust a string\n---\n42\n---${DEPLOYMENT}`);

      const result = await service.convertComposeFile(COMPOSE_PATH);

      expect(result.manifests.map((m) => m.fileName)).toEqual([
        'web-deployment.yaml',
      ]);
    });

    it('drops List items that are not objects', async () => {
      mockFile();
      komposeAnswers(
        [
          'apiVersion: v1',
          'kind: List',
          'items:',
          '  - null',
          '  - plain-text',
          '  - kind: Service',
          '    metadata:',
          '      name: web',
        ].join('\n')
      );

      const result = await service.convertComposeFile(COMPOSE_PATH);

      expect(result.manifests).toHaveLength(1);
      expect(result.manifests[0]).toMatchObject({
        kind: 'Service',
        name: 'web',
      });
    });

    it('keeps a List document without an items array as one resource', async () => {
      mockFile();
      komposeAnswers('kind: List\nmetadata:\n  name: odd\n');

      const result = await service.convertComposeFile(COMPOSE_PATH);

      expect(result.manifests).toEqual([
        expect.objectContaining({
          kind: 'List',
          name: 'odd',
          fileName: 'odd-list.yaml',
        }),
      ]);
    });

    it('names resources without kind or name by position', async () => {
      mockFile();
      komposeAnswers(
        [
          'apiVersion: v1',
          'data:',
          '  a: b',
          '---',
          'kind: ""',
          'metadata:',
          '  name: ""',
          '---',
          'kind: 7',
          'metadata:',
          '  name: 9',
        ].join('\n')
      );

      const result = await service.convertComposeFile(COMPOSE_PATH);

      expect(
        result.manifests.map(({ kind, name, fileName }) => ({
          kind,
          name,
          fileName,
        }))
      ).toEqual([
        {
          kind: 'Resource',
          name: 'resource-1',
          fileName: 'resource-1-resource.yaml',
        },
        {
          kind: 'Resource',
          name: 'resource-2',
          fileName: 'resource-2-resource.yaml',
        },
        {
          kind: 'Resource',
          name: 'resource-3',
          fileName: 'resource-3-resource.yaml',
        },
      ]);
      expect(result.manifests[0].content).toContain('apiVersion: v1');
    });
  });

  describe('kompose warnings', () => {
    it('reads logfmt warnings and errors, quoted or not, without duplicates', async () => {
      mockFile();
      komposeAnswers(
        DEPLOYMENT,
        [
          'time="2026-01-01T00:00:00Z" level=warning msg="Volume mount on the host is not supported"',
          'time="2026-01-01T00:00:00Z" level=error msg=Unsupported key network_mode',
          'time="2026-01-01T00:00:00Z" level=warning msg="Volume mount on the host is not supported"',
          'time="2026-01-01T00:00:00Z" level=warning',
          'time="2026-01-01T00:00:00Z" level=info msg="Kubernetes file created"',
          'ERRO[0001] Could not parse the env file ',
        ].join('\r\n')
      );

      const result = await service.convertComposeFile(COMPOSE_PATH);

      expect(result.warnings).toEqual([
        'Volume mount on the host is not supported',
        'Unsupported key network_mode',
        'Could not parse the env file',
      ]);
    });
  });

  describe('locally built images', () => {
    it('ignores services declared without a body', async () => {
      mockFile(
        'services:\n  empty:\n  scalar: just-text\n  api:\n    build: .\n'
      );
      komposeAnswers(DEPLOYMENT);

      const result = await service.convertComposeFile(COMPOSE_PATH);

      expect(result.locallyBuiltImages).toEqual(['api']);
    });

    it('uses the service name when the image is blank', async () => {
      mockFile('services:\n  api:\n    build: .\n    image: ""\n');
      komposeAnswers(DEPLOYMENT);

      const result = await service.convertComposeFile(COMPOSE_PATH);

      expect(result.locallyBuiltImages).toEqual(['api']);
    });

    it('returns no local images when services is not a mapping', async () => {
      mockFile('services: web\n');
      komposeAnswers(DEPLOYMENT);

      const result = await service.convertComposeFile(COMPOSE_PATH);

      expect(result.locallyBuiltImages).toEqual([]);
    });

    it('returns no local images when the compose file has no services', async () => {
      mockFile('version: "3"\n');
      komposeAnswers(DEPLOYMENT);

      const result = await service.convertComposeFile(COMPOSE_PATH);

      expect(result.locallyBuiltImages).toEqual([]);
    });
  });
});
