import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StarRating } from '../../../features/marketplace/StarRating';

describe('StarRating', () => {
  it('renders five stars with fractional fills and a formatted review count', () => {
    const { container } = render(<StarRating rating={3.5} reviews={1234} />);

    expect(screen.getByLabelText('3.5 out of 5 stars')).toBeInTheDocument();
    expect(container.querySelectorAll('svg')).toHaveLength(5);
    expect(container.querySelectorAll('stop[offset="50%"]')).toHaveLength(2);
    expect(
      screen.getByText(`3.5 (${(1234).toLocaleString()})`)
    ).toBeInTheDocument();
  });

  it('clamps star fills and can hide the review count', () => {
    const { container, rerender } = render(
      <StarRating rating={-1} size={20} showCount={false} />
    );

    expect(container.querySelectorAll('stop[offset="0%"]')).toHaveLength(10);
    expect(container.querySelector('svg')).toHaveAttribute('width', '20');
    expect(
      container.querySelector('.star-rating__count')
    ).not.toBeInTheDocument();

    rerender(<StarRating rating={8} reviews={0} />);
    expect(container.querySelectorAll('stop[offset="100%"]')).toHaveLength(10);
    expect(screen.getByText('8.0 (0)')).toBeInTheDocument();
  });
});
