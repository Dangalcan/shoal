/**
 * Migration Service
 *
 * Converts a docker-compose file into Kubernetes manifests using the
 * kompose CLI (https://kompose.io, Apache 2.0). The binary is invoked
 * through safe-exec, so it must be on the allowlist and on PATH.
 *
 * Conversion is read-only: kompose writes nothing to disk because we use
 * `--stdout`. Saving/applying the result goes through the existing
 * manifest database.
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { safeExec } from '../../utils/safe-exec';
import { getErrorMessage } from '../../utils/error-utils';
import log from '../../logger';
import type {
  ComposeConversion,
  ConvertedManifest,
  KomposeStatus,
} from '../../types/migration-types';

const COMPOSE_EXTENSIONS = new Set(['.yml', '.yaml']);
/** Compose files are hand-written config; anything above 1 MiB is suspect. */
const MAX_COMPOSE_FILE_SIZE = 1024 * 1024;
const VERSION_TIMEOUT_MS = 10_000;
const CONVERT_TIMEOUT_MS = 60_000;

interface ComposeServiceDefinition {
  image?: unknown;
  build?: unknown;
}

interface ComposeDocument {
  services?: Record<string, ComposeServiceDefinition | null>;
}

interface K8sDocument {
  kind?: unknown;
  metadata?: { name?: unknown };
  items?: unknown[];
}

export class MigrationService {
  /** Probe for the kompose binary. Never throws — absence is a valid state. */
  async checkKompose(): Promise<KomposeStatus> {
    try {
      const { stdout } = await safeExec('kompose', ['version'], {
        timeout: VERSION_TIMEOUT_MS,
      });
      return { available: true, version: stdout.trim() };
    } catch {
      return { available: false };
    }
  }

  /**
   * Convert a compose file to Kubernetes manifests.
   *
   * @throws if the file is invalid or kompose fails/produces nothing.
   */
  async convertComposeFile(filePath: string): Promise<ComposeConversion> {
    await this.assertComposeFile(filePath);

    const { stdout, stderr } = await safeExec(
      'kompose',
      [
        'convert',
        '--file',
        filePath,
        '--stdout',
        '--with-kompose-annotation=false',
      ],
      { timeout: CONVERT_TIMEOUT_MS }
    );

    const manifests = this.parseManifests(stdout);
    if (manifests.length === 0) {
      throw new Error(
        'kompose produced no Kubernetes resources. ' +
          'Check that the compose file defines at least one service with an image and ports.'
      );
    }

    return {
      manifests,
      warnings: this.parseKomposeWarnings(stderr),
      locallyBuiltImages: await this.findLocallyBuiltImages(filePath),
    };
  }

  private async assertComposeFile(filePath: string): Promise<void> {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('Compose file path is required');
    }
    if (!COMPOSE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
      throw new Error('Compose file must be a .yml or .yaml file');
    }

    let stats;
    try {
      stats = await fs.stat(filePath);
    } catch {
      throw new Error(`Compose file not found: ${filePath}`);
    }
    if (!stats.isFile()) {
      throw new Error(`Not a file: ${filePath}`);
    }
    if (stats.size > MAX_COMPOSE_FILE_SIZE) {
      throw new Error('Compose file is too large (max 1 MiB)');
    }
  }

  /**
   * Split kompose stdout into one manifest per Kubernetes resource.
   * Handles both multi-document YAML and the `kind: List` wrapper that
   * some kompose versions emit.
   */
  private parseManifests(stdout: string): ConvertedManifest[] {
    let documents: unknown[];
    try {
      documents = yaml.loadAll(stdout);
    } catch (error: unknown) {
      throw new Error(
        `Failed to parse kompose output as YAML: ${getErrorMessage(error)}`
      );
    }

    const resources: K8sDocument[] = [];
    for (const doc of documents) {
      if (!doc || typeof doc !== 'object') continue;
      const k8sDoc = doc as K8sDocument;
      if (k8sDoc.kind === 'List' && Array.isArray(k8sDoc.items)) {
        for (const item of k8sDoc.items) {
          if (item && typeof item === 'object') {
            resources.push(item as K8sDocument);
          }
        }
      } else {
        resources.push(k8sDoc);
      }
    }

    return resources.map((resource, index) => {
      const kind =
        typeof resource.kind === 'string' && resource.kind
          ? resource.kind
          : 'Resource';
      const name =
        typeof resource.metadata?.name === 'string' && resource.metadata.name
          ? resource.metadata.name
          : `resource-${index + 1}`;
      return {
        fileName: `${name}-${kind.toLowerCase()}.yaml`,
        kind,
        name,
        content: yaml.dump(resource, { noRefs: true }),
      };
    });
  }

  /**
   * Extract warning/error lines from kompose's logrus output on stderr,
   * e.g. `WARN[0000] Service "web" won't be created because ...`.
   */
  private parseKomposeWarnings(stderr: string): string[] {
    const warnings: string[] = [];
    for (const line of stderr.split(/\r?\n/)) {
      const bracketMatch = line.match(/^\s*(?:WARN|ERRO)\w*\[\d+\]\s*(.+)$/);
      if (bracketMatch) {
        warnings.push(bracketMatch[1].trim());
        continue;
      }
      if (/level=(warning|error)/.test(line)) {
        const msgMatch = line.match(/msg="([^"]*)"/) ?? line.match(/msg=(.+)$/);
        if (msgMatch) warnings.push(msgMatch[1].trim());
      }
    }
    return [...new Set(warnings)];
  }

  /**
   * Services with a `build:` key produce images that only exist in the
   * local Docker daemon — a cluster cannot pull them. Best effort: a
   * compose file we cannot parse yields an empty list, not an error
   * (kompose itself already accepted the file).
   */
  private async findLocallyBuiltImages(filePath: string): Promise<string[]> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const compose = yaml.load(raw) as ComposeDocument | null;
      if (!compose?.services || typeof compose.services !== 'object') {
        return [];
      }

      const images: string[] = [];
      for (const [serviceName, service] of Object.entries(compose.services)) {
        if (!service || typeof service !== 'object') continue;
        if (service.build === undefined) continue;
        images.push(
          typeof service.image === 'string' && service.image
            ? service.image
            : serviceName
        );
      }
      return images;
    } catch (error: unknown) {
      log.warn(
        '[Migration] Could not inspect compose file for local images:',
        getErrorMessage(error)
      );
      return [];
    }
  }
}

export const migrationService = new MigrationService();
