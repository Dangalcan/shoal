import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils';
import { createMockElectronAPI } from '../utils/mocks';
import { Manifests } from '../../pages/Manifests';

describe('Manifests editor focus', () => {
  let api: ReturnType<typeof createMockElectronAPI>;

  beforeEach(() => {
    api = createMockElectronAPI();
  });

  it('focuses the name field when creating a manifest', async () => {
    render(<Manifests />, { api });

    fireEvent.click(
      await screen.findByRole('button', { name: 'New Manifest' })
    );

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText('Name'))
    );
  });

  it('never pulls focus back to the name field while the user types', async () => {
    render(<Manifests />, { api });
    fireEvent.click(
      await screen.findByRole('button', { name: 'New Manifest' })
    );

    // The user moves to the YAML field right away; a delayed focus() call
    // used to yank the caret back to "Name" about 100 ms later.
    const yaml = screen.getByLabelText('YAML Configuration');
    yaml.focus();
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(document.activeElement).toBe(yaml);
  });
});
