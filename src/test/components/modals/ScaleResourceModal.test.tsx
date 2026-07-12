import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScaleResourceModal } from '../../../components/modals/ScaleResourceModal';

function renderModal(
  overrides: Partial<Parameters<typeof ScaleResourceModal>[0]> = {}
) {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    onScale: vi.fn(),
    resourceType: 'deployments',
    resourceName: 'web',
    currentReplicas: 3,
    ...overrides,
  };
  render(<ScaleResourceModal {...props} />);
  return props;
}

describe('ScaleResourceModal', () => {
  it('shows the resource and its current replica count', () => {
    renderModal();

    expect(screen.getByText('web')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByLabelText('Replica count')).toHaveValue(3);
  });

  it('disables the confirm button while the count is unchanged', () => {
    renderModal();

    expect(screen.getByRole('button', { name: /Scale to 3/ })).toBeDisabled();
  });

  it('scales to the value set in the number input and closes', () => {
    const props = renderModal();

    fireEvent.change(screen.getByLabelText('Replica count'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Scale to 5/ }));

    expect(props.onScale).toHaveBeenCalledWith(5);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('updates the count from the slider', () => {
    const props = renderModal();

    fireEvent.change(screen.getByLabelText('Replica count slider'), {
      target: { value: '7' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Scale to 7/ }));

    expect(props.onScale).toHaveBeenCalledWith(7);
  });

  it('warns when scaling to zero', () => {
    renderModal();

    fireEvent.change(screen.getByLabelText('Replica count'), {
      target: { value: '0' },
    });

    expect(screen.getByText(/stops all pods/)).toBeInTheDocument();
  });

  it('disables confirm for out-of-range values', () => {
    renderModal();

    fireEvent.change(screen.getByLabelText('Replica count'), {
      target: { value: '1001' },
    });

    expect(screen.getByRole('button', { name: /Scale to/ })).toBeDisabled();
  });

  it('normalizes invalid numeric input and disables fractional replica values', () => {
    renderModal();
    const input = screen.getByLabelText('Replica count');

    fireEvent.change(input, { target: { value: 'not-a-number' } });
    expect(input).toHaveValue(0);
    expect(screen.getByText(/stops all pods/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '2.8' } });
    expect(input).toHaveValue(2);
    expect(screen.getByRole('button', { name: /Scale to 2/ })).toBeEnabled();
  });

  it('resets the count to the resource value each time it reopens', () => {
    const { rerender } = render(
      <ScaleResourceModal
        isOpen={false}
        onClose={vi.fn()}
        onScale={vi.fn()}
        resourceType="deployments"
        resourceName="web"
        currentReplicas={3}
      />
    );

    rerender(
      <ScaleResourceModal
        isOpen
        onClose={vi.fn()}
        onScale={vi.fn()}
        resourceType="deployments"
        resourceName="web"
        currentReplicas={6}
      />
    );

    expect(screen.getByLabelText('Replica count')).toHaveValue(6);
  });

  it('does not scale when cancelled', () => {
    const props = renderModal();

    fireEvent.click(screen.getByText('Cancel'));

    expect(props.onClose).toHaveBeenCalled();
    expect(props.onScale).not.toHaveBeenCalled();
  });
});
