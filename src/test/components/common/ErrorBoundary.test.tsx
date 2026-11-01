import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '../../utils';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test Error');
  }
  return <div>Normal Content</div>;
};

describe('ErrorBoundary', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    // Suppress console.error in tests because ErrorBoundary logs it
    console.error = vi.fn();
    vi.stubGlobal('location', { reload: vi.fn(), href: '', hash: '' });
  });

  afterEach(() => {
    console.error = originalConsoleError;
    vi.unstubAllGlobals();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Normal Content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Normal Content')).toBeInTheDocument();
  });

  it('renders error UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Reload Application')).toBeInTheDocument();
  });

  it('calls window.location.reload when reload button is clicked', () => {
    vi.useFakeTimers();
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText('Reload Application'));
    vi.runAllTimers();
    expect(window.location.reload).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should navigate home when "Back to Dashboard" is clicked', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // We already mocked window.location in beforeEach
    // But we need to verify the assignment
    // vi.stubGlobal('location', { ... })
    // Usually assigning to window.location.href works with jsdom if configured,
    // or we might need to use Object.defineProperty if it's read-only in test env.
    // Our beforeEach stubs 'location' with an object.

    fireEvent.click(screen.getByText('Back to Dashboard'));

    // HashRouter: going "home" must not navigate the window to file:///.
    expect(window.location.hash).toBe('#/');
    expect(window.location.href).toBe('');
  });

  it('writes the error to the main log', () => {
    const logRendererError = vi.mocked(window.electron.logRendererError);
    logRendererError.mockClear();

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(logRendererError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'error-boundary',
        message: 'Error: Test Error',
      })
    );
  });

  it('opens a prefilled GitHub issue from "Report a problem"', async () => {
    const openExternal = vi.mocked(window.electron.openExternal);
    openExternal.mockClear();
    vi.mocked(window.electron.getAppInfo).mockResolvedValueOnce({
      success: true,
      data: {
        version: 'v0.9.0',
        platform: 'win32',
        arch: 'x64',
        electron: '44.7.0',
        logsPath: 'C:/logs',
      },
    });

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText('Report a problem'));

    await vi.waitFor(() => expect(openExternal).toHaveBeenCalled());
    const url = new URL(String(openExternal.mock.calls[0]?.[0]));
    expect(url.origin + url.pathname).toBe(
      'https://github.com/Dangalcan/shoal/issues/new'
    );
    expect(url.searchParams.get('version')).toBe('v0.9.0');
    expect(url.searchParams.get('what')).toContain('Error: Test Error');
  });

  it('still opens the issue form when the app information is unavailable', async () => {
    const openExternal = vi.mocked(window.electron.openExternal);
    openExternal.mockClear();
    vi.mocked(window.electron.getAppInfo).mockResolvedValueOnce({
      success: false,
      error: 'no info',
    });

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText('Report a problem'));

    await vi.waitFor(() => expect(openExternal).toHaveBeenCalled());
    const url = new URL(String(openExternal.mock.calls[0]?.[0]));
    expect(url.searchParams.get('version')).toBe('unknown');
    expect(url.searchParams.get('what')).toContain('Error: Test Error');
  });

  it('still opens the issue form when asking for app information fails', async () => {
    const openExternal = vi.mocked(window.electron.openExternal);
    openExternal.mockClear();
    vi.mocked(window.electron.getAppInfo).mockRejectedValueOnce(
      new Error('ipc closed')
    );

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText('Report a problem'));

    await vi.waitFor(() => expect(openExternal).toHaveBeenCalled());
    const url = new URL(String(openExternal.mock.calls[0]?.[0]));
    expect(url.searchParams.get('version')).toBe('unknown');
    expect(url.searchParams.get('os')).toBe('unknown');
  });

  it('keeps the fallback on screen when the browser cannot be opened', async () => {
    const openExternal = vi.mocked(window.electron.openExternal);
    openExternal.mockClear();
    openExternal.mockRejectedValueOnce(new Error('no browser'));

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText('Report a problem'));

    await vi.waitFor(() => expect(openExternal).toHaveBeenCalledTimes(1));
    await expect(openExternal.mock.results[0]?.value).rejects.toThrow(
      'no browser'
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('logs the error without a component stack when React gives none', () => {
    const logRendererError = vi.mocked(window.electron.logRendererError);
    logRendererError.mockClear();
    const error = new Error('lifecycle');
    error.stack = 'Error: lifecycle\n    at render';

    new ErrorBoundary({}).componentDidCatch(error, { componentStack: null });

    expect(logRendererError).toHaveBeenCalledWith({
      source: 'error-boundary',
      message: 'Error: lifecycle',
      stack: 'Error: lifecycle\n    at render',
    });
  });

  it('hides the error details outside development', () => {
    vi.stubEnv('NODE_ENV', 'production');

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText(/Error: Test Error/)).toBeNull();

    vi.unstubAllEnvs();
  });

  it('should show error details in development mode', () => {
    // Process.env is usually stringified.
    // We need to mock process.env.NODE_ENV
    // Vitest uses `vi.stubEnv`

    vi.stubEnv('NODE_ENV', 'development');

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Error: Test Error/)).toBeInTheDocument();

    vi.unstubAllEnvs();
  });
});
