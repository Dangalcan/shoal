import { describe, it, expect } from 'vitest';
import { render, screen } from '../../utils';
import { Spinner } from '../../../components/ui/Spinner';

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

  it('maps a known string size to its pixel value', () => {
    render(<Spinner size="lg" />);
    expect(document.querySelector('.ui-spinner-icon')).toHaveAttribute(
      'width',
      '60'
    );
  });

  it('falls back to 24 for an unknown string size', () => {
    render(<Spinner size="bogus" />);
    expect(document.querySelector('.ui-spinner-icon')).toHaveAttribute(
      'width',
      '24'
    );
  });
});
