import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MigrationReview } from '../../../features/migration/components/MigrationReview';
import type { ComposeConversion } from '../../../types';

/**
 * The review step of the Compose migration: the folder name field, the
 * kompose warnings and local-image notices, and the two actions.
 */

const conversion: ComposeConversion = {
  manifests: [
    {
      fileName: 'web-deployment.yaml',
      kind: 'Deployment',
      name: 'web',
      content: 'kind: Deployment',
    },
    {
      fileName: 'web-service.yaml',
      kind: 'Service',
      name: 'web',
      content: 'kind: Service',
    },
  ],
  warnings: ['Volume mount on the host is not supported'],
  locallyBuiltImages: ['shop/web:dev'],
};

function renderReview(
  overrides: Partial<Parameters<typeof MigrationReview>[0]> = {}
) {
  const props = {
    composePath: 'C:/project/docker-compose.yml',
    conversion,
    currentContext: 'kind-dev',
    projectName: 'shop',
    importing: false,
    onProjectNameChange: vi.fn(),
    onUpdateManifest: vi.fn(),
    onRemoveManifest: vi.fn(),
    onImport: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
  render(<MigrationReview {...props} />);
  return props;
}

describe('MigrationReview', () => {
  it('shows the warnings, the local images and the manifests', () => {
    renderReview();

    expect(
      screen.getByText('Volume mount on the host is not supported')
    ).toBeInTheDocument();
    expect(screen.getByText('shop/web:dev')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /web-deployment\.yaml/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /web-service\.yaml/ })
    ).toBeInTheDocument();
  });

  it('reports folder name edits and the two actions', () => {
    const props = renderReview();

    fireEvent.change(screen.getByLabelText('Manifest folder name'), {
      target: { value: 'shop-v2' },
    });
    expect(props.onProjectNameChange).toHaveBeenCalledWith('shop-v2');

    fireEvent.click(screen.getByRole('button', { name: /Import 2 manifests/ }));
    expect(props.onImport).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(props.onReset).toHaveBeenCalledTimes(1);
  });

  it('disables both actions while importing', () => {
    renderReview({ importing: true });

    expect(screen.getByRole('button', { name: 'Start over' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /Import 2 manifests/ })
    ).toBeDisabled();
  });

  it('leaves out the warning boxes when kompose reported nothing', () => {
    renderReview({
      conversion: { ...conversion, warnings: [], locallyBuiltImages: [] },
    });

    expect(screen.queryByText('kompose warnings')).not.toBeInTheDocument();
    expect(screen.queryByText('Locally built images')).not.toBeInTheDocument();
    expect(screen.getByText('web-deployment.yaml')).toBeInTheDocument();
  });

  it('shows a placeholder context while it is still loading', () => {
    renderReview({ currentContext: null });

    expect(screen.getByText('...')).toBeInTheDocument();
    expect(screen.queryByText('kind-dev')).not.toBeInTheDocument();
  });
});
