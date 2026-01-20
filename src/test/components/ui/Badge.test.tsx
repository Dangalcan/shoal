import { describe, it, expect } from 'vitest';
import { render, screen } from '../../utils';
import { Badge } from '../../../components/ui/Badge';
import React from 'react';

describe('Badge Component', () => {
  it('renders children correctly', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    const { rerender } = render(<Badge variant="success">Success</Badge>);
    expect(screen.getByText('Success')).toHaveClass('ui-badge-success');

    rerender(<Badge variant="error">Error</Badge>);
    expect(screen.getByText('Error')).toHaveClass('ui-badge-error');

    rerender(<Badge variant="active">Active</Badge>);
    expect(screen.getByText('Active')).toHaveClass('ui-badge-active');
  });

  it('renders with dot when requested', () => {
    const { container } = render(<Badge dot>With Dot</Badge>);
    expect(container.querySelector('.ui-badge-dot')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Badge className="custom-test-class">Text</Badge>);
    expect(screen.getByText('Text')).toHaveClass('custom-test-class');
  });
});
