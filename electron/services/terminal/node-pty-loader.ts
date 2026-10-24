import log from '../../logger';

export type NodePty = typeof import('node-pty');

let loaded: NodePty | null | undefined;

/**
 * node-pty is a native module and its binary may be missing: `npm ci` keeps
 * install scripts off, so on Linux nothing compiles it unless
 * `npm rebuild node-pty --ignore-scripts=false` ran (the Windows x64
 * prebuild ships inside the package). The first call tries once and logs
 * why it failed; afterwards local shells run over pipes, exactly as they
 * did before node-pty existed.
 */
export function loadNodePty(): NodePty | null {
  if (loaded !== undefined) return loaded;
  try {
    // Resolved lazily: on Linux node-pty loads its binary at require time,
    // so a static import would throw at startup when the binary is missing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require('node-pty') as NodePty;
    log.info('[Terminal] node-pty loaded: local shells get a pseudo-terminal');
  } catch (err) {
    loaded = null;
    log.warn(
      '[Terminal] node-pty is not available, local shells run over pipes:',
      err instanceof Error ? err.message : String(err)
    );
  }
  return loaded;
}

/** Forgets the cached result so the next call loads again (tests only). */
export function resetNodePtyForTests(): void {
  loaded = undefined;
}
