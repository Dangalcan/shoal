import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ManifestEditor } from '../../../features/migration/components/ManifestEditor';

const manifest = {
  fileName: 'web-deployment.yaml',
  kind: 'Deployment',
  name: 'web',
  content: 'apiVersion: apps/v1\nkind: Deployment\n',
};

describe('ManifestEditor', () => {
  it('expands to edit the YAML and collapses again', () => {
    const onChange = vi.fn();
    render(
      <ManifestEditor
        manifest={manifest}
        index={2}
        onChange={onChange}
        onRemove={vi.fn()}
        canRemove
      />
    );

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /web-deployment\.yaml/ })
    );

    const editor = screen.getByRole('textbox');
    expect(editor).toHaveValue(manifest.content);
    fireEvent.change(editor, { target: { value: 'kind: Service' } });
    expect(onChange).toHaveBeenCalledWith(2, 'kind: Service');

    fireEvent.click(
      screen.getByRole('button', { name: /web-deployment\.yaml/ })
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('excludes the resource from the import', () => {
    const onRemove = vi.fn();
    render(
      <ManifestEditor
        manifest={manifest}
        index={1}
        onChange={vi.fn()}
        onRemove={onRemove}
        canRemove
      />
    );

    fireEvent.click(screen.getByTitle('Exclude from import'));
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('hides the exclude button for the last remaining resource', () => {
    render(
      <ManifestEditor
        manifest={manifest}
        index={0}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        canRemove={false}
      />
    );
    expect(screen.queryByTitle('Exclude from import')).not.toBeInTheDocument();
  });
});
