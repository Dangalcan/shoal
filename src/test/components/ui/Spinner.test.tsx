import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test-utils';
import { Spinner } from '../../../components/ui/Spinner';
import React from 'react';

describe('Spinner Component', () => {
  it('renders correctly', () => {
    render(<Spinner />);
    expect(document.querySelector('.ui-spinner-icon')).toBeInTheDocument();
  });

  it('renders with label', () => {
    render(<Spinner label="Loading..." />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Spinner className="custom-spinner" />);
    expect(container.firstChild).toHaveClass('custom-spinner');
  });
});
