/**
 * resource-modal-tests.tsx
 *
 * Shared test factory for resource modals (DescribeModal, YamlModal).
 * Generates the 8 common test cases parameterized by component and API method.
 */
import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '../utils';
import { mockElectronAPI, writeTextMock } from '../setup';
import type { ComponentType } from 'react';
import type { ElectronAPI } from '../../types.d';

export interface ResourceModalTestOptions {
  /** Key of the ElectronAPI method to mock (e.g. 'describeResource') */
  apiMethod: keyof ElectronAPI;
  /** Text that identifies the modal title, matched with regex */
  titlePattern: RegExp;
  /** Expected subtitle text (e.g. 'default / test-pod') */
  subtitleText: string;
  /** Data string returned by the successful API call */
  successData: string;
  /** Matcher used when asserting content is visible (can differ from successData for multiline) */
  contentMatcher: string | RegExp;
  /** Text shown while loading (regex) */
  loadingPattern: RegExp;
}

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  clusterName: 'test-cluster',
  resourceName: 'test-pod',
  resourceType: 'pod',
  namespace: 'default',
};

export function createResourceModalTests(
  Component: ComponentType<any>,
  opts: ResourceModalTestOptions
) {
  const {
    apiMethod,
    titlePattern,
    subtitleText,
    successData,
    contentMatcher,
    loadingPattern,
  } = opts;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiMock = () => mockElectronAPI[apiMethod] as any;

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock().mockResolvedValue({ success: true, data: successData });
  });

  it('should not render when closed', () => {
    const { container } = render(
      <Component {...defaultProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render and fetch data when open', async () => {
    render(<Component {...defaultProps} />);

    expect(screen.getByText(titlePattern)).toBeInTheDocument();
    expect(screen.getByText(subtitleText)).toBeInTheDocument();

    await waitFor(() => {
      expect(apiMock()).toHaveBeenCalledWith({
        contextName: 'test-cluster',
        resourceType: 'pod',
        resourceName: 'test-pod',
        namespace: 'default',
      });
      expect(screen.getByText(contentMatcher)).toBeInTheDocument();
    });
  });

  it('should handle API success', async () => {
    render(<Component {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(contentMatcher)).toBeInTheDocument();
      expect(screen.queryByText(/Error/i)).not.toBeInTheDocument();
    });
  });

  it('should handle API failure (success: false)', async () => {
    apiMock().mockResolvedValue({ success: false, error: 'Custom API Error' });

    render(<Component {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Custom API Error')).toBeInTheDocument();
    });
  });

  it('should handle API exception (catch block)', async () => {
    apiMock().mockRejectedValue(new Error('Network failure'));

    render(<Component {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Network failure')).toBeInTheDocument();
    });
  });

  it('should show loading state', async () => {
    apiMock().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ success: true, data: 'done' }), 100)
        )
    );

    render(<Component {...defaultProps} />);

    expect(screen.getByText(loadingPattern)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('done')).toBeInTheDocument();
    });
  });

  it('should handle copy to clipboard', async () => {
    render(<Component {...defaultProps} />);

    await waitFor(() =>
      expect(screen.getByText(contentMatcher)).toBeInTheDocument()
    );

    const copyBtn = screen.getByText('Copy').closest('button')!;
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(successData);
    expect(await screen.findByText('Copied!')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.getByText('Copy')).toBeInTheDocument();
      },
      { timeout: 2500 }
    );
  });

  it('should handle close button', async () => {
    const onClose = vi.fn();
    render(<Component {...defaultProps} onClose={onClose} />);

    const closeBtn = screen.getByText('Close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
}
