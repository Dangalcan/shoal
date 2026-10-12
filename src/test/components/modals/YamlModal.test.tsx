import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  mockElectronAPI,
  mockToast,
} from '../../utils';
import { YamlModal } from '../../../components/modals/YamlModal';
import { createResourceModalTests } from '../../helpers/resource-modal-tests';

const YAML_DATA = 'apiVersion: v1\nkind: Pod';

describe('YamlModal', () => {
  createResourceModalTests(YamlModal, {
    apiMethod: 'getResourceYaml',
    titlePattern: /Resource YAML/i,
    subtitleText: 'default / test-pod',
    successData: YAML_DATA,
    contentMatcher: /apiVersion: v1/,
    loadingPattern: /Fetching YAML for test-pod\.\.\./i,
  });

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    clusterName: 'test-cluster',
    resourceName: 'test-pod',
    resourceType: 'pod',
    namespace: 'default',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI.getResourceYaml.mockResolvedValue({
      success: true,
      data: YAML_DATA,
    });
  });

  it('should handle save to database success', async () => {
    if (!mockElectronAPI.saveManifest) mockElectronAPI.saveManifest = vi.fn();
    mockElectronAPI.saveManifest.mockResolvedValue({ success: true });
    render(<YamlModal {...defaultProps} />);

    await waitFor(() =>
      expect(screen.getByText(/apiVersion: v1/)).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText('Save to DB').closest('button')!);

    expect(mockElectronAPI.saveManifest).toHaveBeenCalledWith({
      name: 'test-pod',
      content: YAML_DATA,
      cluster_context: 'test-cluster',
    });

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        'Manifest "test-pod" saved to database'
      );
    });
  });

  it('should handle save to database failure', async () => {
    if (!mockElectronAPI.saveManifest) mockElectronAPI.saveManifest = vi.fn();
    mockElectronAPI.saveManifest.mockResolvedValue({
      success: false,
      error: 'Database error',
    });
    render(<YamlModal {...defaultProps} />);

    await waitFor(() =>
      expect(screen.getByText(/apiVersion: v1/)).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText('Save to DB').closest('button')!);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to save manifest: Database error'
      );
    });
  });

  it('should handle save to database exception', async () => {
    if (!mockElectronAPI.saveManifest) mockElectronAPI.saveManifest = vi.fn();
    mockElectronAPI.saveManifest.mockRejectedValue(new Error('Network error'));
    render(<YamlModal {...defaultProps} />);

    await waitFor(() =>
      expect(screen.getByText(/apiVersion: v1/)).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText('Save to DB').closest('button')!);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'Error saving manifest: Network error'
      );
    });
  });

  it('should re-fetch when resourceName changes', async () => {
    const { rerender } = render(<YamlModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockElectronAPI.getResourceYaml).toHaveBeenCalledWith(
        expect.objectContaining({ resourceName: 'test-pod' })
      );
    });

    rerender(<YamlModal {...defaultProps} resourceName="new-pod" />);

    await waitFor(() => {
      expect(mockElectronAPI.getResourceYaml).toHaveBeenCalledWith(
        expect.objectContaining({ resourceName: 'new-pod' })
      );
    });
  });

  it('should display "No output available" when YAML is empty', async () => {
    mockElectronAPI.getResourceYaml.mockResolvedValue({
      success: true,
      data: '',
    });
    render(<YamlModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No output available')).toBeInTheDocument();
    });
  });
});
