import { describe, it, expect, vi, afterEach } from 'vitest';
import { readManifestFile } from '../../../features/manifests/manifest-file-import';

/**
 * Reading a picked or dropped YAML file: only .yaml/.yml names are read, the
 * extension is dropped from the name, and a reader that fails or hands back
 * something other than text rejects with the file name.
 */

type ReaderOutcome =
  { kind: 'load'; result: string | ArrayBuffer | null } | { kind: 'error' };

/** A FileReader stand-in that answers readAsText with `outcome`. */
function stubFileReader(outcome: ReaderOutcome) {
  class FakeFileReader {
    onload: ((event: { target: { result: unknown } | null }) => void) | null =
      null;
    onerror: (() => void) | null = null;
    readAsText() {
      queueMicrotask(() => {
        if (outcome.kind === 'error') this.onerror?.();
        else this.onload?.({ target: { result: outcome.result } });
      });
    }
  }
  vi.stubGlobal('FileReader', FakeFileReader);
}

describe('readManifestFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads a .yml file and drops the extension from its name', async () => {
    const file = new File(['kind: Pod'], 'web.pod.yml', { type: 'text/yaml' });

    await expect(readManifestFile(file)).resolves.toEqual({
      name: 'web.pod',
      content: 'kind: Pod',
    });
  });

  it('accepts an upper-case .YAML extension', async () => {
    const file = new File(['kind: Service'], 'SVC.YAML');

    await expect(readManifestFile(file)).resolves.toEqual({
      name: 'SVC',
      content: 'kind: Service',
    });
  });

  it('rejects a file that is not YAML', async () => {
    const file = new File(['{}'], 'deployment.json');

    await expect(readManifestFile(file)).rejects.toThrow(
      'Invalid file type: deployment.json'
    );
  });

  it('rejects when the reader does not hand back text', async () => {
    stubFileReader({ kind: 'load', result: new ArrayBuffer(4) });

    await expect(
      readManifestFile(new File(['x'], 'binary.yaml'))
    ).rejects.toThrow('Failed to read file: binary.yaml');
  });

  it('rejects when the reader fails', async () => {
    stubFileReader({ kind: 'error' });

    await expect(
      readManifestFile(new File(['x'], 'locked.yaml'))
    ).rejects.toThrow('Error reading file: locked.yaml');
  });
});
