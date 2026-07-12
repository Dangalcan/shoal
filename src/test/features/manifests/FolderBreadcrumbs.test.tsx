import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FolderBreadcrumbs } from '../../../features/manifests/FolderBreadcrumbs';
import { MANIFEST_DRAG_TYPE } from '../../../features/manifests/manifest-dnd';
import { FOLDER_DRAG_TYPE } from '../../../features/manifests/manifest-dnd';
import type { ManifestFolder } from '../../../types.d';

function makeFolder(overrides: Partial<ManifestFolder>): ManifestFolder {
  return {
    id: 1,
    name: 'folder',
    parent_id: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

const path = [
  makeFolder({ id: 1, name: 'infra' }),
  makeFolder({ id: 3, name: 'nginx', parent_id: 1 }),
];

describe('FolderBreadcrumbs', () => {
  const onNavigate = vi.fn();
  const onDropManifest = vi.fn();
  const onDropFolder = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderCrumbs = (breadcrumbs = path) =>
    render(
      <FolderBreadcrumbs
        breadcrumbs={breadcrumbs}
        onNavigate={onNavigate}
        onDropManifest={onDropManifest}
        onDropFolder={onDropFolder}
      />
    );

  it('renders the root and every ancestor', () => {
    renderCrumbs();
    expect(screen.getByText('All Manifests')).toBeInTheDocument();
    expect(screen.getByText('infra')).toBeInTheDocument();
    expect(screen.getByText('nginx')).toBeInTheDocument();
  });

  it('navigates to the root', () => {
    renderCrumbs();
    fireEvent.click(screen.getByText('All Manifests'));
    expect(onNavigate).toHaveBeenCalledWith(null);
  });

  it('navigates to an ancestor folder', () => {
    renderCrumbs();
    fireEvent.click(screen.getByText('infra'));
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it('accepts a manifest dropped on a crumb', () => {
    renderCrumbs();
    fireEvent.drop(screen.getByText('All Manifests'), {
      dataTransfer: {
        types: [MANIFEST_DRAG_TYPE],
        getData: (type: string) => (type === MANIFEST_DRAG_TYPE ? '9' : ''),
      },
    });
    expect(onDropManifest).toHaveBeenCalledWith(9, null);
  });

  it('accepts a folder dropped on an ancestor and ignores unrelated drags', () => {
    renderCrumbs();
    const infra = screen.getByText('infra');

    fireEvent.drop(infra, {
      dataTransfer: {
        types: [FOLDER_DRAG_TYPE],
        getData: (type: string) => (type === FOLDER_DRAG_TYPE ? '9' : ''),
      },
    });
    fireEvent.drop(infra, {
      dataTransfer: { types: ['Files'], getData: () => '' },
    });

    expect(onDropFolder).toHaveBeenCalledWith(9, 1);
    expect(onDropManifest).not.toHaveBeenCalled();
  });
});
