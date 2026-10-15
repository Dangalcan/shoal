/**
 * Migration Types
 *
 * Shared shapes for the Docker Compose → Kubernetes migration feature.
 * Imported by both the main process (service + IPC) and the renderer
 * (src/types.d.ts), so keep this file free of Electron/Node imports.
 */

/** Result of probing for the kompose CLI. */
export interface KomposeStatus {
  available: boolean;
  version?: string;
}

/**
 * A compose file picked in the native dialog. The renderer converts it by
 * token, never by path; the path is only shown to the user.
 */
export interface ComposeFileSelection {
  token: string;
  filePath: string;
}

/** A single Kubernetes resource produced by kompose. */
export interface ConvertedManifest {
  /** Suggested file/manifest name, e.g. "web-deployment.yaml". */
  fileName: string;
  kind: string;
  /** metadata.name of the resource. */
  name: string;
  /** The resource as a YAML document. */
  content: string;
}

/** Full output of a compose file conversion. */
export interface ComposeConversion {
  manifests: ConvertedManifest[];
  /** Warnings kompose emitted for keys it could not convert. */
  warnings: string[];
  /**
   * Images that are built locally (services with a `build:` key).
   * A cluster cannot pull these, so the user must load or push them first.
   */
  locallyBuiltImages: string[];
}

/** One manifest to import into the manifest library. */
export interface MigrationManifestEntry {
  name: string;
  content: string;
}

export interface MigrationImportArgs {
  /** Name for the manifest folder that groups the migration. */
  projectName: string;
  /** Cluster context the manifests are saved against. */
  contextName: string;
  manifests: MigrationManifestEntry[];
}

export interface MigrationImportResult {
  folderId: number;
  manifestIds: number[];
}
