import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../utils';
import { BaseModal } from '../../../components/modals/BaseModal';

describe('BaseModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Modal',
    children: <div>Modal Content</div>,
  };

  it('should render when isOpen is true', () => {
    render(<BaseModal {...defaultProps} />);
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('should not render when isOpen is false', () => {
    render(<BaseModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    render(<BaseModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Close modal'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should call onClose when clicking on the backdrop', () => {
    render(<BaseModal {...defaultProps} />);
    // The overlay has the base-modal-overlay class and handleBackdropClick
    const overlay = screen
      .getByText('Modal Content')
      .closest('.base-modal-overlay')!;
    fireEvent.click(overlay);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should not call onClose when clicking inside the modal container', () => {
    render(<BaseModal {...defaultProps} />);
    const container = screen
      .getByText('Modal Content')
      .closest('.base-modal-container')!;
    fireEvent.click(container);
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('should call onClose when Escape key is pressed', () => {
    render(<BaseModal {...defaultProps} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should render subtitle and icon when provided', () => {
    render(
      <BaseModal
        {...defaultProps}
        subtitle="Test Subtitle"
        icon={<span data-testid="test-icon">icon</span>}
      />
    );
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('should render header actions and footer when provided', () => {
    render(
      <BaseModal
        {...defaultProps}
        headerActions={<button>Header Action</button>}
        footer={<div>Footer Content</div>}
      />
    );
    expect(screen.getByText('Header Action')).toBeInTheDocument();
    expect(screen.getByText('Footer Content')).toBeInTheDocument();
  });

  it('should apply custom className and styles', () => {
    render(
      <BaseModal
        {...defaultProps}
        className="custom-modal"
        width={500}
        maxWidth="90%"
      />
    );
    const container = screen
      .getByText('Modal Content')
      .closest('.base-modal-container')!;
    expect(container).toHaveClass('custom-modal');
    expect(container).toHaveStyle({ width: '500px', maxWidth: '90%' });
  });

  it('should prevent body scroll when open', () => {
    render(<BaseModal {...defaultProps} />);
    expect(document.body.style.overflow).toBe('hidden');
  });
});
