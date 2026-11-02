import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, render } from '../../utils';
import { NamespaceSelector } from '../../../components/cluster/NamespaceSelector';

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
    const select = screen.getByLabelText(
      'Namespace Selector'
    ) as HTMLSelectElement;
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
    fireEvent.change(screen.getByLabelText('Namespace Selector'), {
      target: { value: 'default' },
    });
    expect(onNamespaceChange).toHaveBeenCalledWith('default');
  });

  it('shows the selected namespace when the list does not have it', () => {
    const onChange = vi.fn();
    render(
      <NamespaceSelector
        namespaces={['default']}
        selectedNamespace="missing"
        onNamespaceChange={onChange}
      />
    );
    const select = screen.getByRole<HTMLSelectElement>('combobox');
    expect(select.value).toBe('missing');

    fireEvent.change(select, { target: { value: 'all' } });
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('lists each namespace once', () => {
    render(
      <NamespaceSelector
        namespaces={['default', 'kube-system']}
        selectedNamespace="default"
        onNamespaceChange={vi.fn()}
      />
    );
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'All Namespaces',
      'default',
      'kube-system',
    ]);
  });
});
