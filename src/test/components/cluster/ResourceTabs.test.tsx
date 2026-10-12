import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, render } from '../../utils';
import { ResourceTabs } from '../../../components/cluster/ResourceTabs';
import { Layout } from 'lucide-react';

const mockTabs = [
  { id: 'pods', label: 'Pods', icon: Layout },
  { id: 'deployments', label: 'Deployments', icon: Layout },
];

describe('ResourceTabs', () => {
  it('renders all provided tabs', () => {
    render(
      <ResourceTabs
        tabs={mockTabs as any}
        activeTab="pods"
        onTabChange={vi.fn()}
      />
    );
    expect(screen.getByText('Pods')).toBeInTheDocument();
    expect(screen.getByText('Deployments')).toBeInTheDocument();
  });

  it('highlights the active tab', () => {
    render(
      <ResourceTabs
        tabs={mockTabs as any}
        activeTab="pods"
        onTabChange={vi.fn()}
      />
    );
    const podsBtn = screen.getByText('Pods').closest('button');
    const deployBtn = screen.getByText('Deployments').closest('button');
    expect(podsBtn).toHaveClass('tab-button-active');
    expect(deployBtn).toHaveClass('tab-button-inactive');
  });

  it('calls onTabChange when a tab is clicked', () => {
    const onTabChange = vi.fn();
    render(
      <ResourceTabs
        tabs={mockTabs as any}
        activeTab="pods"
        onTabChange={onTabChange}
      />
    );
    fireEvent.click(screen.getByText('Deployments'));
    expect(onTabChange).toHaveBeenCalledWith('deployments');
  });
});
