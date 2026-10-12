import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, render } from '../../utils';
import { SettingsDropdown } from '../../../components/cluster/SettingsDropdown';
import {
  DisplaySettingsContext,
  type DisplaySettingsContextType,
} from '../../../features/clusters/DisplaySettingsContext';

const mockVisibleResources = ['pods', 'deployments'];
const mockVisibleColumns = ['name', 'status'];

function renderWithContext(
  overrides: Partial<DisplaySettingsContextType> = {}
) {
  const defaultCtx: DisplaySettingsContextType = {
    isSettingsOpen: false,
    toggleSettings: vi.fn(),
    closeSettings: vi.fn(),
    visibleResources: mockVisibleResources as any,
    toggleResource: vi.fn(),
    activeTab: 'pods' as any,
    visibleColumns: mockVisibleColumns,
    toggleColumn: vi.fn(),
    ...overrides,
  };

  return {
    ...render(
      <DisplaySettingsContext.Provider value={defaultCtx}>
        <SettingsDropdown />
      </DisplaySettingsContext.Provider>
    ),
    ctx: defaultCtx,
  };
}

describe('SettingsDropdown', () => {
  it('renders the settings button', () => {
    renderWithContext();
    expect(screen.getByTitle('Display Settings')).toBeInTheDocument();
  });

  it('does not show the dropdown when isSettingsOpen is false', () => {
    renderWithContext({ isSettingsOpen: false });
    expect(screen.queryByText('Display Settings')).not.toBeInTheDocument();
  });

  it('shows the dropdown when isSettingsOpen is true', () => {
    renderWithContext({ isSettingsOpen: true });
    expect(screen.getAllByText('Display Settings')[0]).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
  });

  it('calls toggleSettings when settings button is clicked', () => {
    const toggleSettings = vi.fn();
    renderWithContext({ toggleSettings });
    fireEvent.click(screen.getByTitle('Display Settings'));
    expect(toggleSettings).toHaveBeenCalled();
  });

  it('calls closeSettings when close button is clicked', () => {
    const closeSettings = vi.fn();
    renderWithContext({ isSettingsOpen: true, closeSettings });
    fireEvent.click(screen.getByTitle('Close Settings'));
    expect(closeSettings).toHaveBeenCalled();
  });

  it('calls toggleResource when a resource button is clicked', () => {
    const toggleResource = vi.fn();
    renderWithContext({ isSettingsOpen: true, toggleResource });
    const podsButton = screen.getByText('Pods').closest('button');
    fireEvent.click(podsButton!);
    expect(toggleResource).toHaveBeenCalledWith('pods');
  });

  it('calls toggleColumn when a column button is clicked', () => {
    const toggleColumn = vi.fn();
    renderWithContext({ isSettingsOpen: true, toggleColumn });
    const nameButton = screen.getByText('Name').closest('button');
    fireEvent.click(nameButton!);
    expect(toggleColumn).toHaveBeenCalledWith('name');
  });

  it('filters resources based on search query', () => {
    renderWithContext({ isSettingsOpen: true });
    const searchInput = screen.getByPlaceholderText('Filter resources...');

    fireEvent.change(searchInput, { target: { value: 'pods' } });
    expect(screen.getByText('Pods')).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'nonexistentresource' } });
    expect(screen.queryByText('Pods')).not.toBeInTheDocument();
  });

  it('toggles resource categories', () => {
    renderWithContext({ isSettingsOpen: true });

    const workloadsHeader = screen.getByText('Workloads').closest('button');
    expect(workloadsHeader).toBeInTheDocument();
    expect(screen.getByText('Pods')).toBeInTheDocument();

    fireEvent.click(workloadsHeader!);
    expect(screen.queryByText('Pods')).not.toBeInTheDocument();

    fireEvent.click(workloadsHeader!);
    expect(screen.getByText('Pods')).toBeInTheDocument();
  });
});
