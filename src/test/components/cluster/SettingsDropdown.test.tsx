import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { SettingsDropdown } from '../../../components/cluster/SettingsDropdown';
import { render } from '../../test-utils';
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
    expect(screen.getByTitle('Visible Resources')).toBeInTheDocument();
  });

  it('does not show the dropdown when isOpen is false', () => {
    render(<SettingsDropdown {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Display Settings')).not.toBeInTheDocument();
  });

  it('shows the dropdown when isOpen is true', () => {
    render(<SettingsDropdown {...defaultProps} isOpen={true} />);
    expect(screen.getByText('Display Settings')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
  });

  it('calls onToggle when settings button is clicked', () => {
    const onToggle = vi.fn();
    render(<SettingsDropdown {...defaultProps} onToggle={onToggle} />);
    fireEvent.click(screen.getByTitle('Visible Resources'));
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
});
