import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Animate } from '../../../components/ui/Animate';

describe('Animate', () => {
  it('fades its children in a div by default, without a delay', () => {
    render(<Animate>Hello</Animate>);

    const el = screen.getByText('Hello');
    expect(el.tagName).toBe('DIV');
    expect(el).toHaveClass('animate-fade-in', { exact: true });
    expect(el).not.toHaveAttribute('style');
  });

  it.each([
    ['fade', 'animate-fade-in'],
    ['slide-up', 'animate-slide-in-bottom'],
    ['slide-down', 'animate-slide-in-top'],
    ['slide-left', 'animate-slide-in-right'],
    ['slide-right', 'animate-slide-in-left'],
    ['scale', 'animate-scale-in'],
  ] as const)('maps %s to %s', (type, className) => {
    render(<Animate type={type}>Item</Animate>);
    expect(screen.getByText('Item')).toHaveClass(className, { exact: true });
  });

  it('delays the animation and renders the requested element', () => {
    render(
      <Animate as="section" delay={150} className="extra">
        Late
      </Animate>
    );

    const el = screen.getByText('Late');
    expect(el.tagName).toBe('SECTION');
    expect(el).toHaveClass('animate-fade-in extra', { exact: true });
    expect(el).toHaveStyle({ animationDelay: '150ms' });
  });
});
