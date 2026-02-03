import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within, render } from '../../utils';
import { SettingsDropdown } from '../../../components/cluster/SettingsDropdown';
import { Layout } from 'lucide-react';

const mockVisibleResources = ['pods', 'deployments'];
const mockVisibleColumns = ['name', 'status'];

describe('SettingsDropdown', () => {
  const defaultProps = {
    isOpen: false,
    onToggle: vi.fn(),
    onClose: vi.fn(),
    visibleResources: mockVisibleResources as any,
    onToggleResource: vi.fn(),
    activeTab: 'pods' as any,
    visibleColumns: mockVisibleColumns,
    onToggleColumn: vi.fn(),
  };

  it('renders the settings button', () => {
    render(<SettingsDropdown {...defaultProps} />);
    expect(screen.getByTitle('Display Settings')).toBeInTheDocument();
  });

  it('does not show the dropdown when isOpen is false', () => {
    render(<SettingsDropdown {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Display Settings')).not.toBeInTheDocument();
  });

  it('shows the dropdown when isOpen is true', () => {
    render(<SettingsDropdown {...defaultProps} isOpen={true} />);
    expect(screen.getAllByText('Display Settings')[0]).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
  });

  it('calls onToggle when settings button is clicked', () => {
    const onToggle = vi.fn();
    render(<SettingsDropdown {...defaultProps} onToggle={onToggle} />);
    fireEvent.click(screen.getByTitle('Display Settings'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<SettingsDropdown {...defaultProps} isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByTitle('Close Settings'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onToggleResource when a resource button is clicked', () => {
    const onToggleResource = vi.fn();
    render(<SettingsDropdown {...defaultProps} isOpen={true} onToggleResource={onToggleResource} />);
    // Testing the "Pods" item (it should be in the list)
    const podsButton = screen.getByText('Pods').closest('button');
    fireEvent.click(podsButton!);
    expect(onToggleResource).toHaveBeenCalledWith('pods');
  });

  it('calls onToggleColumn when a column button is clicked', () => {
    const onToggleColumn = vi.fn();
    render(<SettingsDropdown {...defaultProps} isOpen={true} onToggleColumn={onToggleColumn} />);
    // "Name" is a default column for pods
    const nameButton = screen.getByText('Name').closest('button');
    fireEvent.click(nameButton!);
    expect(onToggleColumn).toHaveBeenCalledWith('name');
  });

  it('filters resources based on search query', () => {
    render(<SettingsDropdown {...defaultProps} isOpen={true} />);
    const searchInput = screen.getByPlaceholderText('Filter resources...');
    
    // Type search query
    fireEvent.change(searchInput, { target: { value: 'pods' } });
    
    expect(screen.getByText('Pods')).toBeInTheDocument();
    // 'Deployments' should still be there if they match or if category is open
    // But let's check for something that shouldn't match
    fireEvent.change(searchInput, { target: { value: 'nonexistentresource' } });
    expect(screen.queryByText('Pods')).not.toBeInTheDocument();
  });

  it('toggles resource categories', () => {
    render(<SettingsDropdown {...defaultProps} isOpen={true} />);
    
    // Find a category header (e.g., Workloads)
    const workloadsHeader = screen.getByText('Workloads').closest('button');
    expect(workloadsHeader).toBeInTheDocument();
    
    // Initially "Pods" should be visible because Workloads is expanded by default
    expect(screen.getByText('Pods')).toBeInTheDocument();
    
    // Click category header to collapse
    fireEvent.click(workloadsHeader!);
    
    // Now "Pods" should be hidden
    expect(screen.queryByText('Pods')).not.toBeInTheDocument();
    
    // Click again to expand
    fireEvent.click(workloadsHeader!);
    expect(screen.getByText('Pods')).toBeInTheDocument();
  });
});
