import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ManifestCard } from '../../../features/manifests/ManifestCard';
import { MANIFEST_DRAG_TYPE } from '../../../features/manifests/manifest-dnd';
import type { Manifest } from '../../../types.d';

const manifest: Manifest = {
  id: 5,
  name: 'nginx',
  cluster_context: 'kind-dev',
  content: 'kind: Deployment',
  folder_id: null,
  created_at: '2026-10-01 10:00:00',
  updated_at: '2026-10-01 10:00:00',
};

function renderCard(
  overrides: Partial<Parameters<typeof ManifestCard>[0]> = {}
) {
  const props = {
    manifest,
    applying: null,
    onApply: vi.fn(),
    onEdit: vi.fn(),
    onMove: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  const view = render(<ManifestCard {...props} />);
  return { ...view, props };
}

describe('ManifestCard', () => {
  it('passes the manifest to each action', () => {
    const { props } = renderCard();

    fireEvent.click(screen.getByTitle('Apply to Cluster'));
    fireEvent.click(screen.getByTitle('Edit Manifest'));
    fireEvent.click(screen.getByTitle('Move to Folder'));
    fireEvent.click(screen.getByTitle('Delete'));

    expect(props.onApply).toHaveBeenCalledWith(5);
    expect(props.onEdit).toHaveBeenCalledWith(manifest);
    expect(props.onMove).toHaveBeenCalledWith(manifest);
    expect(props.onDelete).toHaveBeenCalledWith(5);
  });

  it('hides the move button when moving is not available', () => {
    renderCard({ onMove: undefined });
    expect(screen.queryByTitle('Move to Folder')).not.toBeInTheDocument();
  });

  it('disables apply while this manifest is being applied', () => {
    renderCard({ applying: 5 });
    expect(screen.getByTitle('Apply to Cluster')).toBeDisabled();
  });

  it('shows the context and truncates long YAML', () => {
    const long = 'x'.repeat(200);
    const { container } = renderCard({
      manifest: { ...manifest, content: long },
    });

    expect(screen.getByText('Context: kind-dev')).toBeInTheDocument();
    expect(container.querySelector('.yaml-preview')?.textContent).toBe(
      `${'x'.repeat(150)}...`
    );
  });

  it('starts a typed drag with the manifest id', () => {
    const { container } = renderCard();
    const setData = vi.fn();

    fireEvent.dragStart(
      container.querySelector('.manifest-card') as HTMLElement,
      {
        dataTransfer: { setData },
      }
    );

    expect(setData).toHaveBeenCalledWith(MANIFEST_DRAG_TYPE, '5');
  });
});
