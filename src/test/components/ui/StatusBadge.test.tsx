import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../../../components/ui/StatusBadge';

describe('StatusBadge (ui)', () => {
  it.each([
    ['success', 'status-badge-success'],
    ['warning', 'status-badge-warning'],
    ['error', 'status-badge-error'],
    ['neutral', 'status-badge-other'],
  ] as const)('renders the %s variant with %s', (variant, className) => {
    render(<StatusBadge label="Bound" variant={variant} />);

    expect(screen.getByText('Bound')).toHaveClass(`status-badge ${className}`, {
      exact: true,
    });
  });
});
