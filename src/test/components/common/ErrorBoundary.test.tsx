import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import React from 'react';

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
    vi.stubGlobal('location', { reload: vi.fn(), href: '' });
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
});
