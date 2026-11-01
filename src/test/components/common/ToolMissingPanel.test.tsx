import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolMissingPanel } from '../../../components/common/ToolMissingPanel';

describe('ToolMissingPanel', () => {
  const renderPanel = (compact?: boolean) => {
    const onOpenInstallDocs = vi.fn();
    const onRecheck = vi.fn();
    render(
      <ToolMissingPanel
        title="kubectl not found"
        description={<span>Install kubectl to manage clusters.</span>}
        onOpenInstallDocs={onOpenInstallDocs}
        onRecheck={onRecheck}
        compact={compact}
      />
    );
    return { onOpenInstallDocs, onRecheck };
  };

  it('announces the missing tool with its explanation', () => {
    renderPanel();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('tool-missing', { exact: true });
    expect(alert).toHaveTextContent('kubectl not found');
    expect(alert).toHaveTextContent('Install kubectl to manage clusters.');
  });

  it('uses the compact banner style when asked', () => {
    renderPanel(true);

    expect(screen.getByRole('alert')).toHaveClass(
      'tool-missing tool-missing--compact',
      { exact: true }
    );
  });

  it('opens the install docs and rechecks from its buttons', () => {
    const { onOpenInstallDocs, onRecheck } = renderPanel();

    fireEvent.click(
      screen.getByRole('button', { name: 'Install instructions' })
    );
    expect(onOpenInstallDocs).toHaveBeenCalledTimes(1);
    expect(onRecheck).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(onRecheck).toHaveBeenCalledTimes(1);
  });
});
