import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { NamespaceSelector } from '../../../components/cluster/NamespaceSelector';
import { render } from '../../test-utils';

const mockNamespaces = ['default', 'kube-system'];

describe('NamespaceSelector', () => {
  it('renders the select element with namespaces', () => {
    render(
      <NamespaceSelector 
        namespaces={mockNamespaces} 
        selectedNamespace="all" 
        onNamespaceChange={vi.fn()} 
      />
    );
    expect(screen.getByLabelText('Namespace Selector')).toBeInTheDocument();
    expect(screen.getByText('All Namespaces')).toBeInTheDocument();
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('kube-system')).toBeInTheDocument();
  });

  it('shows the correct selected namespace', () => {
    render(
      <NamespaceSelector 
        namespaces={mockNamespaces} 
        selectedNamespace="kube-system" 
        onNamespaceChange={vi.fn()} 
      />
    );
    const select = screen.getByLabelText('Namespace Selector') as HTMLSelectElement;
    expect(select.value).toBe('kube-system');
  });

  it('calls onNamespaceChange when selection changes', () => {
    const onNamespaceChange = vi.fn();
    render(
      <NamespaceSelector 
        namespaces={mockNamespaces} 
        selectedNamespace="all" 
        onNamespaceChange={onNamespaceChange} 
      />
    );
    fireEvent.change(screen.getByLabelText('Namespace Selector'), { target: { value: 'default' } });
    expect(onNamespaceChange).toHaveBeenCalledWith('default');
  });
});
