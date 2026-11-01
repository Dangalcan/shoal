import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Migration } from '../../pages/Migration';
import { render, screen, fireEvent, waitFor } from '../utils';
import { createMockElectronAPI } from '../utils/mocks';
import { Route, Routes, useLocation } from 'react-router-dom';
import type { ComposeConversion } from '../../types.d';

let mockApi: ReturnType<typeof createMockElectronAPI>;

function CurrentPath() {
  return <p data-testid="current-path">{useLocation().pathname}</p>;
}

const conversion: ComposeConversion = {
  manifests: [
    {
      fileName: 'web-deployment.yaml',
      kind: 'Deployment',
      name: 'web',
      content: 'kind: Deployment',
    },
  ],
  warnings: ['Restart policy "unless-stopped" is not supported'],
  locallyBuiltImages: ['api'],
};

describe('Migration Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockElectronAPI({
      getCurrentContext: vi
        .fn()
        .mockResolvedValue({ success: true, data: 'kind-test' }),
      migrationConvertCompose: vi
        .fn()
        .mockResolvedValue({ success: true, data: conversion }),
    });
  });

  it('renders the page header', async () => {
    render(<Migration />, { api: mockApi });

    await waitFor(() => {
      expect(
        screen.getByText('Migrate from Docker Compose')
      ).toBeInTheDocument();
    });
  });

  it('shows install instructions when kompose is missing', async () => {
    mockApi.migrationCheckKompose = vi
      .fn()
      .mockResolvedValue({ success: true, data: { available: false } });

    render(<Migration />, { api: mockApi });

    await waitFor(() => {
      expect(screen.getByText('kompose not found')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Install instructions'));
    expect(mockApi.openExternal).toHaveBeenCalledWith(
      'https://kompose.io/installation/'
    );
  });

  it('shows the select step when kompose is available', async () => {
    render(<Migration />, { api: mockApi });

    await waitFor(() => {
      expect(screen.getByText('Select compose file')).toBeInTheDocument();
    });
  });

  it('shows manifests, warnings and local image hints after conversion', async () => {
    render(<Migration />, { api: mockApi });
    await waitFor(() => {
      expect(screen.getByText('Select compose file')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select compose file'));

    await waitFor(() => {
      expect(screen.getByText('web-deployment.yaml')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Restart policy "unless-stopped" is not supported')
    ).toBeInTheDocument();
    expect(screen.getByText('Locally built images')).toBeInTheDocument();
    expect(screen.getByText('Import 1 manifests')).toBeInTheDocument();
  });

  it('imports the manifests and shows the done step', async () => {
    render(<Migration />, { api: mockApi });
    await waitFor(() => {
      expect(screen.getByText('Select compose file')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select compose file'));
    await waitFor(() => {
      expect(screen.getByText('Import 1 manifests')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Import 1 manifests'));

    await waitFor(() => {
      expect(screen.getByText('Migration imported')).toBeInTheDocument();
    });
    expect(mockApi.migrationImportManifests).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'compose-migration',
        contextName: 'kind-test',
      })
    );
  });

  it('shows the conversion in progress on the select button', async () => {
    mockApi.migrationConvertCompose = vi.fn(() => new Promise<never>(() => {}));
    render(<Migration />, { api: mockApi });

    fireEvent.click(await screen.findByText('Select compose file'));

    const converting = await screen.findByRole('button', {
      name: 'Converting...',
    });
    expect(converting).toBeDisabled();
    expect(mockApi.migrationConvertCompose).toHaveBeenCalledWith(
      'mock-compose-token'
    );
  });

  it('opens the Manifests page from the done step', async () => {
    render(
      <Routes>
        <Route path="/migration" element={<Migration />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>,
      { api: mockApi, initialEntries: ['/migration'] }
    );
    fireEvent.click(await screen.findByText('Select compose file'));
    fireEvent.click(await screen.findByText('Import 1 manifests'));

    fireEvent.click(
      await screen.findByRole('button', { name: 'Open Manifests' })
    );

    expect(screen.getByTestId('current-path')).toHaveTextContent('/manifests');
  });
});
