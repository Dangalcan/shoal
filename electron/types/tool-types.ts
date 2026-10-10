/**
 * Tool Types
 *
 * Shared shape for CLI tool detection (kubectl, helm, kind, docker, ...).
 * Imported by both the main process and the renderer (src/types.d.ts), so
 * keep this file free of Electron/Node imports.
 */

/** Result of probing one CLI tool. Probing never fails: absence is a state. */
export interface ToolStatus {
  tool: string;
  /** The binary was found on PATH and answered its version command. */
  installed: boolean;
  /** First line of the version output, when installed. */
  version?: string;
  /**
   * Container engines only (docker, podman): whether the daemon answers.
   * Undefined for every other tool.
   */
  running?: boolean;
}
