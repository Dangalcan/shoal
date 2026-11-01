import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';
import { registerManifestsIpcHandlers } from '../ipc/manifests-ipc';
import { manifestDb } from '../database';

vi.mock('../logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock('../database', () => ({
  manifestDb: {
    getManifests: vi.fn(),
    saveManifest: vi.fn(),
    deleteManifest: vi.fn(),
    applyManifest: vi.fn(),
    getFolders: vi.fn(),
    saveFolder: vi.fn(),
    deleteFolder: vi.fn(),
    moveManifest: vi.fn(),
    moveFolder: vi.fn(),
  },
}));

type IpcHandler = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

const mockEvent = {} as IpcMainInvokeEvent;

function getHandler(channel: string): IpcHandler {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as IpcHandler;
}

describe('manifests-ipc manifest CRUD handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerManifestsIpcHandlers();
  });

  it('get-manifests returns manifests, forwarding the cluster context', async () => {
    const manifests = [{ id: 1, name: 'nginx' }];
    vi.mocked(manifestDb.getManifests).mockReturnValue(
      manifests as ReturnType<typeof manifestDb.getManifests>
    );

    const result = await getHandler('get-manifests')(mockEvent, 'kind-dev');

    expect(result).toEqual({ success: true, data: manifests });
    expect(manifestDb.getManifests).toHaveBeenCalledWith('kind-dev');
  });

  it('save-manifest persists the manifest and returns its id', async () => {
    vi.mocked(manifestDb.saveManifest).mockReturnValue(42);

    const manifest = { name: 'svc', content: 'apiVersion: v1' };
    const result = await getHandler('save-manifest')(mockEvent, manifest);

    expect(result).toEqual({ success: true, data: 42 });
    expect(manifestDb.saveManifest).toHaveBeenCalledWith(manifest);
  });

  it('delete-manifest removes the manifest and returns true', async () => {
    const result = await getHandler('delete-manifest')(mockEvent, 3);

    expect(result).toEqual({ success: true, data: true });
    expect(manifestDb.deleteManifest).toHaveBeenCalledWith(3);
  });

  it('apply-manifest returns the apply result', async () => {
    const applyResult = { stdout: 'deployment/web created', stderr: '' };
    vi.mocked(manifestDb.applyManifest).mockResolvedValue(applyResult);

    const result = await getHandler('apply-manifest')(mockEvent, 5);

    expect(result).toEqual({ success: true, data: applyResult });
    expect(manifestDb.applyManifest).toHaveBeenCalledWith(5);
  });

  it('apply-manifest surfaces database errors as a failed Result', async () => {
    vi.mocked(manifestDb.applyManifest).mockRejectedValue(
      new Error('kubectl apply failed')
    );

    const result = await getHandler('apply-manifest')(mockEvent, 5);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/kubectl apply failed/);
  });
});

describe('manifests-ipc folder handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerManifestsIpcHandlers();
  });

  describe('get-manifest-folders', () => {
    it('returns folders from the database', async () => {
      const folders = [{ id: 1, name: 'infra', parent_id: null }];
      vi.mocked(manifestDb.getFolders).mockReturnValue(
        folders as ReturnType<typeof manifestDb.getFolders>
      );

      const result = await getHandler('get-manifest-folders')(mockEvent);

      expect(result).toEqual({ success: true, data: folders });
    });
  });

  describe('save-manifest-folder', () => {
    it('saves a valid folder', async () => {
      vi.mocked(manifestDb.saveFolder).mockReturnValue(7);

      const result = await getHandler('save-manifest-folder')(mockEvent, {
        name: 'prod',
        parent_id: null,
      });

      expect(result).toEqual({ success: true, data: 7 });
      expect(manifestDb.saveFolder).toHaveBeenCalledWith({
        name: 'prod',
        parent_id: null,
      });
    });

    it('rejects a missing name', async () => {
      const result = await getHandler('save-manifest-folder')(mockEvent, {
        name: '   ',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/name is required/i);
      expect(manifestDb.saveFolder).not.toHaveBeenCalled();
    });

    it('rejects a name longer than 100 characters', async () => {
      const result = await getHandler('save-manifest-folder')(mockEvent, {
        name: 'x'.repeat(101),
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/at most 100/i);
    });

    it('rejects a non-integer parent id', async () => {
      const result = await getHandler('save-manifest-folder')(mockEvent, {
        name: 'ok',
        parent_id: 'DROP TABLE' as unknown as number,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid parent folder id/i);
    });
  });

  describe('delete-manifest-folder', () => {
    it('deletes with an explicit mode', async () => {
      const result = await getHandler('delete-manifest-folder')(
        mockEvent,
        3,
        'recursive'
      );

      expect(result).toEqual({ success: true, data: true });
      expect(manifestDb.deleteFolder).toHaveBeenCalledWith(3, 'recursive');
    });

    it('rejects an invalid mode', async () => {
      const result = await getHandler('delete-manifest-folder')(
        mockEvent,
        3,
        'nuke'
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid folder delete mode/i);
      expect(manifestDb.deleteFolder).not.toHaveBeenCalled();
    });

    it('rejects a non-positive id', async () => {
      const result = await getHandler('delete-manifest-folder')(mockEvent, 0);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid folder id/i);
    });
  });

  describe('move-manifest', () => {
    it('moves a manifest into a folder', async () => {
      const result = await getHandler('move-manifest')(mockEvent, 5, 2);

      expect(result).toEqual({ success: true, data: true });
      expect(manifestDb.moveManifest).toHaveBeenCalledWith(5, 2);
    });

    it('moves a manifest to the root with null', async () => {
      const result = await getHandler('move-manifest')(mockEvent, 5, null);

      expect(result).toEqual({ success: true, data: true });
      expect(manifestDb.moveManifest).toHaveBeenCalledWith(5, null);
    });

    it('rejects an invalid manifest id', async () => {
      const result = await getHandler('move-manifest')(mockEvent, -1, 2);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid manifest id/i);
      expect(manifestDb.moveManifest).not.toHaveBeenCalled();
    });
  });

  describe('move-manifest-folder', () => {
    it('moves a folder under a new parent', async () => {
      const result = await getHandler('move-manifest-folder')(mockEvent, 4, 1);

      expect(result).toEqual({ success: true, data: true });
      expect(manifestDb.moveFolder).toHaveBeenCalledWith(4, 1);
    });

    it('surfaces database errors as failures', async () => {
      vi.mocked(manifestDb.moveFolder).mockImplementation(() => {
        throw new Error('Cannot move a folder into its own descendant');
      });

      const result = await getHandler('move-manifest-folder')(mockEvent, 4, 9);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/own descendant/i);
    });

    it.each([null, undefined])(
      'moves a folder to the root with a %s parent',
      async (parentId) => {
        // clearAllMocks keeps the throwing implementation of the test above.
        vi.mocked(manifestDb.moveFolder).mockImplementation(() => undefined);

        const result = await getHandler('move-manifest-folder')(
          mockEvent,
          4,
          parentId
        );

        expect(result).toEqual({ success: true, data: true });
        expect(manifestDb.moveFolder).toHaveBeenCalledWith(4, null);
      }
    );
  });

  describe('manifest validation', () => {
    it.each([
      ['a missing name', { content: 'a: 1' }, /name is required/i],
      ['a blank name', { name: '  ', content: 'a: 1' }, /name is required/i],
      [
        'a name that is too long',
        { name: 'x'.repeat(201), content: 'a: 1' },
        /at most 200/i,
      ],
      ['missing content', { name: 'svc' }, /content is required/i],
      [
        'oversized content',
        { name: 'svc', content: 'x'.repeat(1024 * 1024 + 1) },
        /too large/i,
      ],
      ['a bad id', { id: -1, name: 'svc', content: 'a: 1' }, /manifest id/i],
      [
        'a bad folder id',
        { folder_id: 'x', name: 'svc', content: 'a: 1' },
        /folder id/i,
      ],
      [
        'a bad cluster context',
        { name: 'svc', content: 'a: 1', cluster_context: 42 },
        /cluster context/i,
      ],
      [
        'a cluster context that is too long',
        { name: 'svc', content: 'a: 1', cluster_context: 'c'.repeat(201) },
        /cluster context/i,
      ],
      ['a null manifest', null, /invalid manifest/i],
      ['a manifest that is not an object', 'name: svc', /invalid manifest/i],
    ])('save-manifest rejects %s', async (_label, manifest, message) => {
      const result = await getHandler('save-manifest')(mockEvent, manifest);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(message);
      expect(manifestDb.saveManifest).not.toHaveBeenCalled();
    });

    it.each(['delete-manifest', 'apply-manifest'])(
      '%s rejects an invalid id',
      async (channel) => {
        for (const bad of ['3', 0, -1, 1.5, null, undefined]) {
          const result = await getHandler(channel)(mockEvent, bad);
          expect(result.success).toBe(false);
        }
        expect(manifestDb.deleteManifest).not.toHaveBeenCalled();
        expect(manifestDb.applyManifest).not.toHaveBeenCalled();
      }
    );
  });
});
