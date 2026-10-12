import { describe, it, expect } from 'vitest';
import { render, screen } from '../../utils';
import { Card } from '../../../components/ui/Card';
import React from 'react';

describe('Card Component', () => {
  it('renders children correctly', () => {
    render(<Card>Card Content</Card>);
    expect(screen.getByText('Card Content')).toBeInTheDocument();
  });

  it('renders with title', () => {
    render(<Card title="Test Title">Content</Card>);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
      'Test Title'
    );
  });

  it('renders with header action', () => {
    const Action = () => <button data-testid="card-action">Action</button>;
    render(<Card headerAction={<Action />}>Content</Card>);
    expect(screen.getByTestId('card-action')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <Card className="custom-card-class">Content</Card>
    );
    expect(container.firstChild).toHaveClass('custom-card-class');
  });

  it('renders title and action together', () => {
    render(
      <Card title="Title" headerAction={<button>Action</button>}>
        Content
      </Card>
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });
});
