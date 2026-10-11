import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '../utils';
import { createMockElectronAPI } from '../utils/mocks';
import { mockToast } from '../mocks/toast-mock';
import { Manifests } from '../../pages/Manifests';
import {
  FOLDER_DRAG_TYPE,
  MANIFEST_DRAG_TYPE,
} from '../../features/manifests/manifest-dnd';
import type { Manifest, ManifestFolder } from '../../types.d';

const makeManifest = (overrides: Partial<Manifest> = {}): Manifest => ({
  id: 1,
  name: 'web',
  cluster_context: 'kind-dev',
  content: 'apiVersion: v1\nkind: Pod',
  folder_id: null,
  created_at: '2026-10-01 10:00:00',
  updated_at: '2026-10-01 10:00:00',
  ...overrides,
});

const makeFolder = (
  overrides: Partial<ManifestFolder> = {}
): ManifestFolder => ({
  id: 10,
  name: 'Prod',
  parent_id: null,
  created_at: '2026-10-01 10:00:00',
  updated_at: '2026-10-01 10:00:00',
  ...overrides,
});

/** dataTransfer stand-in for fireEvent drag events. */
const dataTransfer = (
  types: string[],
  data: Record<string, string> = {},
  files: File[] = []
) => ({
  types,
  files,
  getData: (type: string) => data[type] ?? '',
  setData: vi.fn(),
  dropEffect: 'none',
  effectAllowed: 'all',
});

describe('Manifests page actions', () => {
  let api: ReturnType<typeof createMockElectronAPI>;

  const renderWith = (
    manifests: Manifest[] = [makeManifest()],
    folders: ManifestFolder[] = []
  ) => {
    api.getManifests = vi
      .fn()
      .mockResolvedValue({ success: true, data: manifests });
    api.getManifestFolders = vi
      .fn()
      .mockResolvedValue({ success: true, data: folders });
    return render(<Manifests />, { api });
  };

  const openEditor = async () => {
    fireEvent.click(
      await screen.findByRole('button', { name: 'New Manifest' })
    );
    return screen.getByRole('dialog');
  };

  beforeEach(() => {
    api = createMockElectronAPI({
      getCurrentContext: vi
        .fn()
        .mockResolvedValue({ success: true, data: 'kind-dev' }),
    });
  });

  describe('create and edit', () => {
    it('saves a new manifest in the current folder with the active context', async () => {
      renderWith([]);
      await openEditor();
      // Wait for the active context so the save uses it.
      await waitFor(() => expect(api.getCurrentContext).toHaveBeenCalled());

      fireEvent.change(screen.getByLabelText('Name'), {
        target: { value: 'nginx' },
      });
      fireEvent.change(screen.getByLabelText('YAML Configuration'), {
        target: { value: 'kind: Deployment' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save Manifest' }));

      await waitFor(() =>
        expect(api.saveManifest).toHaveBeenCalledWith({
          id: undefined,
          name: 'nginx',
          content: 'kind: Deployment',
          cluster_context: 'kind-dev',
          folder_id: null,
        })
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        'Manifest saved successfully'
      );
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      );
      expect(api.getManifests).toHaveBeenCalledTimes(2);
    });

    it('keeps the editor open and reports a failed save', async () => {
      api.saveManifest = vi
        .fn()
        .mockResolvedValue({ success: false, error: 'db locked' });
      renderWith([]);
      await openEditor();

      fireEvent.change(screen.getByLabelText('Name'), {
        target: { value: 'nginx' },
      });
      fireEvent.change(screen.getByLabelText('YAML Configuration'), {
        target: { value: 'kind: Pod' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save Manifest' }));

      await waitFor(() =>
        expect(mockToast.error).toHaveBeenCalledWith('Failed to save manifest')
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('disables saving until both fields are filled, and cancel closes the editor', async () => {
      renderWith([]);
      await openEditor();

      expect(
        screen.getByRole('button', { name: 'Save Manifest' })
      ).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      );
      expect(api.saveManifest).not.toHaveBeenCalled();
    });

    it('edits an existing manifest without moving it', async () => {
      renderWith([makeManifest({ id: 7, name: 'web', folder_id: null })]);

      fireEvent.click(await screen.findByTitle('Edit Manifest'));
      expect(screen.getByText('Edit Manifest')).toBeInTheDocument();
      expect(screen.getByLabelText('Name')).toHaveValue('web');

      fireEvent.change(screen.getByLabelText('YAML Configuration'), {
        target: { value: 'kind: Service' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Update Manifest' }));

      await waitFor(() =>
        expect(api.saveManifest).toHaveBeenCalledWith({
          id: 7,
          name: 'web',
          content: 'kind: Service',
          cluster_context: 'kind-dev',
        })
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        'Manifest updated successfully'
      );
    });

    it('starts a new manifest from an example template', async () => {
      renderWith([]);

      fireEvent.click(await screen.findByRole('button', { name: 'Examples' }));
      const picker = screen.getByRole('dialog');
      const first = picker.querySelector(
        '.example-templates__item'
      ) as HTMLElement;
      const templateName = first.querySelector(
        '.example-templates__name'
      )?.textContent;
      fireEvent.click(first);

      await waitFor(() =>
        expect(screen.getByText('Create New Manifest')).toBeInTheDocument()
      );
      expect(screen.getByLabelText('Name')).toHaveValue(templateName);
      expect(
        (screen.getByLabelText('YAML Configuration') as HTMLTextAreaElement)
          .value
      ).not.toBe('');
    });
  });

  describe('importing files', () => {
    const fileInput = (container: HTMLElement) =>
      container.querySelector('input[type="file"]') as HTMLInputElement;

    it('imports YAML files and reports the ones it cannot read', async () => {
      const { container } = renderWith([]);
      await screen.findByText('No saved manifests found.');

      fireEvent.change(fileInput(container), {
        target: {
          files: [
            new File(['kind: Pod'], 'pod.yaml'),
            new File(['kind: Service'], 'svc.YML'),
            new File(['hello'], 'notes.txt'),
          ],
        },
      });

      await waitFor(() => expect(api.saveManifest).toHaveBeenCalledTimes(2));
      expect(api.saveManifest).toHaveBeenCalledWith({
        name: 'pod',
        content: 'kind: Pod',
        cluster_context: 'kind-dev',
        folder_id: null,
      });
      expect(mockToast.success).toHaveBeenCalledWith(
        'Successfully imported 2 manifests'
      );
      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to import 1 file: Invalid file type: notes.txt'
      );
    });

    it('reports files the database refuses', async () => {
      api.saveManifest = vi
        .fn()
        .mockResolvedValueOnce({ success: true, data: 1 })
        .mockResolvedValueOnce({ success: false, error: 'disk full' })
        .mockResolvedValueOnce({ success: false });
      const { container } = renderWith([]);
      await screen.findByText('No saved manifests found.');

      fireEvent.change(fileInput(container), {
        target: {
          files: [
            new File(['a: 1'], 'a.yaml'),
            new File(['b: 1'], 'b.yaml'),
            new File(['c: 1'], 'c.yaml'),
          ],
        },
      });

      await waitFor(() =>
        expect(mockToast.error).toHaveBeenCalledWith(
          'Failed to import 2 files: b.yaml: disk full, c.yaml: Save failed'
        )
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        'Successfully imported 1 manifest'
      );
    });

    it('ignores an empty file selection', async () => {
      const { container } = renderWith([]);
      await screen.findByText('No saved manifests found.');

      fireEvent.change(fileInput(container), { target: { files: [] } });

      expect(api.saveManifest).not.toHaveBeenCalled();
    });

    it('opens the file picker from the header button and the empty state', async () => {
      const { container } = renderWith([]);
      const click = vi
        .spyOn(fileInput(container), 'click')
        .mockImplementation(() => {});

      fireEvent.click(await screen.findByText('No saved manifests found.'));
      fireEvent.click(screen.getByRole('button', { name: 'Upload YAML' }));

      expect(click).toHaveBeenCalledTimes(2);
    });

    it('imports files dropped on the page and ignores other drags', async () => {
      const { container } = renderWith([]);
      await screen.findByText('No saved manifests found.');
      const zone = container.querySelector(
        '.manifests-grid-container'
      ) as HTMLElement;

      fireEvent.dragOver(zone, { dataTransfer: dataTransfer(['text/plain']) });
      expect(zone).not.toHaveClass('is-dragging');
      fireEvent.drop(zone, { dataTransfer: dataTransfer(['text/plain']) });

      fireEvent.dragOver(zone, { dataTransfer: dataTransfer(['Files']) });
      expect(zone).toHaveClass('is-dragging');
      fireEvent.dragLeave(zone, { dataTransfer: dataTransfer(['Files']) });
      expect(zone).not.toHaveClass('is-dragging');

      fireEvent.drop(zone, {
        dataTransfer: dataTransfer(['Files'], {}, [
          new File(['kind: Pod'], 'dropped.yaml'),
        ]),
      });

      await waitFor(() =>
        expect(api.saveManifest).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'dropped', content: 'kind: Pod' })
        )
      );
      expect(api.saveManifest).toHaveBeenCalledTimes(1);
    });
  });

  describe('manifest cards', () => {
    it('deletes a manifest after confirmation', async () => {
      renderWith([makeManifest({ id: 3 })]);

      fireEvent.click(await screen.findByTitle('Delete'));
      fireEvent.click(screen.getByRole('button', { name: 'Delete Manifest' }));

      await waitFor(() => expect(api.deleteManifest).toHaveBeenCalledWith(3));
      expect(mockToast.success).toHaveBeenCalledWith(
        'Manifest deleted successfully'
      );
    });

    it('reports a failed delete', async () => {
      api.deleteManifest = vi.fn().mockResolvedValue({ success: false });
      renderWith([makeManifest({ id: 3 })]);

      fireEvent.click(await screen.findByTitle('Delete'));
      fireEvent.click(screen.getByRole('button', { name: 'Delete Manifest' }));

      await waitFor(() =>
        expect(mockToast.error).toHaveBeenCalledWith(
          'Failed to delete manifest'
        )
      );
    });

    it('does not delete when the confirmation is cancelled', async () => {
      renderWith([makeManifest({ id: 3 })]);

      fireEvent.click(await screen.findByTitle('Delete'));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Delete Manifest' })
        ).not.toBeInTheDocument()
      );
      expect(api.deleteManifest).not.toHaveBeenCalled();
    });

    it('applies a manifest to the cluster', async () => {
      renderWith([makeManifest({ id: 4 })]);

      fireEvent.click(await screen.findByTitle('Apply to Cluster'));

      await waitFor(() => expect(api.applyManifest).toHaveBeenCalledWith(4));
      expect(mockToast.success).toHaveBeenCalledWith(
        'Manifest applied successfully!'
      );
      await waitFor(() =>
        expect(screen.getByTitle('Apply to Cluster')).not.toBeDisabled()
      );
    });

    it('shows the kubectl error when applying fails', async () => {
      api.applyManifest = vi
        .fn()
        .mockResolvedValue({ success: false, error: 'no cluster' });
      renderWith([makeManifest({ id: 4 })]);

      fireEvent.click(await screen.findByTitle('Apply to Cluster'));

      await waitFor(() =>
        expect(mockToast.error).toHaveBeenCalledWith(
          'Error applying manifest: no cluster'
        )
      );
    });
  });

  describe('folders', () => {
    const prod = makeFolder({ id: 10, name: 'Prod' });
    const staging = makeFolder({ id: 12, name: 'Staging' });

    it('creates a folder in the current location', async () => {
      renderWith([], []);

      fireEvent.click(
        await screen.findByRole('button', { name: 'New Folder' })
      );
      fireEvent.change(screen.getByLabelText('Folder Name'), {
        target: { value: ' Prod ' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));

      await waitFor(() =>
        expect(api.saveManifestFolder).toHaveBeenCalledWith({
          name: 'Prod',
          parent_id: null,
        })
      );
    });

    it('renames a folder', async () => {
      renderWith([], [prod]);

      fireEvent.click(await screen.findByTitle('Rename Folder'));
      const input = screen.getByLabelText('Folder Name');
      expect(input).toHaveValue('Prod');
      fireEvent.change(input, { target: { value: 'Production' } });
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

      await waitFor(() =>
        expect(api.saveManifestFolder).toHaveBeenCalledWith({
          id: 10,
          name: 'Production',
        })
      );
    });

    it('deletes a folder, moving its contents up by default', async () => {
      renderWith([], [prod]);

      fireEvent.click(await screen.findByTitle('Delete Folder'));
      const dialog = screen.getByRole('dialog');
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Delete Folder' })
      );

      await waitFor(() =>
        expect(api.deleteManifestFolder).toHaveBeenCalledWith(
          10,
          'move-to-parent'
        )
      );
    });

    it('moves a manifest into a folder', async () => {
      renderWith([makeManifest({ id: 1 })], [prod]);

      fireEvent.click(await screen.findByTitle('Move to Folder'));
      fireEvent.click(screen.getByRole('option', { name: 'Prod' }));
      fireEvent.click(screen.getByRole('button', { name: 'Move Here' }));

      await waitFor(() => expect(api.moveManifest).toHaveBeenCalledWith(1, 10));
    });

    it('moves a folder into another folder', async () => {
      renderWith([], [prod, staging]);

      fireEvent.click((await screen.findAllByTitle('Move Folder'))[0]);
      // A folder cannot move into itself.
      expect(screen.getByRole('option', { name: 'Prod' })).toBeDisabled();
      fireEvent.click(screen.getByRole('option', { name: 'Staging' }));
      fireEvent.click(screen.getByRole('button', { name: 'Move Here' }));

      await waitFor(() =>
        expect(api.moveManifestFolder).toHaveBeenCalledWith(10, 12)
      );
    });

    it('closes the move dialog without moving', async () => {
      renderWith([makeManifest({ id: 1 })], [prod]);

      fireEvent.click(await screen.findByTitle('Move to Folder'));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() =>
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      );
      expect(api.moveManifest).not.toHaveBeenCalled();
    });

    it('opens a folder, shows its manifests and goes back through the breadcrumbs', async () => {
      renderWith(
        [
          makeManifest({ id: 1, name: 'root-app' }),
          makeManifest({ id: 2, name: 'prod-app', folder_id: 10 }),
        ],
        [prod, makeFolder({ id: 11, name: 'Empty', parent_id: null })]
      );

      expect(await screen.findByText('root-app')).toBeInTheDocument();
      expect(screen.queryByText('prod-app')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Prod'));
      expect(await screen.findByText('prod-app')).toBeInTheDocument();
      expect(screen.queryByText('root-app')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTitle('All Manifests'));
      expect(await screen.findByText('root-app')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Empty'));
      expect(
        await screen.findByText('This folder is empty.')
      ).toBeInTheDocument();
    });

    it('moves manifests and folders dropped on a folder card', async () => {
      const { container } = renderWith(
        [makeManifest({ id: 1 })],
        [prod, staging]
      );
      await screen.findByText('Prod');
      const prodCard = container.querySelectorAll(
        '.folder-card'
      )[0] as HTMLElement;

      fireEvent.drop(prodCard, {
        dataTransfer: dataTransfer([MANIFEST_DRAG_TYPE], {
          [MANIFEST_DRAG_TYPE]: '1',
        }),
      });
      await waitFor(() => expect(api.moveManifest).toHaveBeenCalledWith(1, 10));

      fireEvent.drop(prodCard, {
        dataTransfer: dataTransfer([FOLDER_DRAG_TYPE], {
          [FOLDER_DRAG_TYPE]: '12',
        }),
      });
      await waitFor(() =>
        expect(api.moveManifestFolder).toHaveBeenCalledWith(12, 10)
      );
    });

    it('moves items dropped on a breadcrumb', async () => {
      renderWith(
        [makeManifest({ id: 2, folder_id: 10 })],
        [prod, makeFolder({ id: 13, name: 'Inner', parent_id: 10 })]
      );

      fireEvent.click(await screen.findByText('Prod'));
      await screen.findByText('Inner');
      const root = screen.getByTitle('All Manifests');

      fireEvent.drop(root, {
        dataTransfer: dataTransfer([MANIFEST_DRAG_TYPE], {
          [MANIFEST_DRAG_TYPE]: '2',
        }),
      });
      await waitFor(() =>
        expect(api.moveManifest).toHaveBeenCalledWith(2, null)
      );

      fireEvent.drop(root, {
        dataTransfer: dataTransfer([FOLDER_DRAG_TYPE], {
          [FOLDER_DRAG_TYPE]: '13',
        }),
      });
      await waitFor(() =>
        expect(api.moveManifestFolder).toHaveBeenCalledWith(13, null)
      );
    });
  });
});
