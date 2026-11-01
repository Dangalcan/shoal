import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MarketplaceToolbar,
  type SortOption,
} from '../../../features/marketplace/MarketplaceToolbar';

function renderToolbar(
  props: Partial<{
    search: string;
    sort: SortOption;
  }> = {}
) {
  const onSearchChange = vi.fn<(value: string) => void>();
  const onSortChange = vi.fn<(value: SortOption) => void>();
  const onRefresh = vi.fn<() => void>();
  render(
    <MarketplaceToolbar
      search={props.search ?? ''}
      sort={props.sort ?? 'popular'}
      onSearchChange={onSearchChange}
      onSortChange={onSortChange}
      onRefresh={onRefresh}
    />
  );
  return { onSearchChange, onSortChange, onRefresh };
}

describe('MarketplaceToolbar', () => {
  it('shows the current search text and reports edits with the new value', async () => {
    const user = userEvent.setup();
    const { onSearchChange } = renderToolbar({ search: 'hel' });

    const input = screen.getByPlaceholderText('Search plugins, tags...');
    expect(input).toHaveValue('hel');

    await user.type(input, 'm');
    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith('helm');

    await user.clear(input);
    expect(onSearchChange).toHaveBeenLastCalledWith('');
  });

  it('lists every sort option in order with the current one selected', () => {
    renderToolbar({ sort: 'free-first' });

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('free-first');
    expect(
      screen.getAllByRole('option').map((option) => option.textContent)
    ).toEqual(['Most Popular', 'Highest Rated', 'Free First', 'Newest']);
    expect(
      screen.getByRole<HTMLOptionElement>('option', { name: 'Free First' })
        .selected
    ).toBe(true);
  });

  it('reports the chosen sort key, not its label', async () => {
    const user = userEvent.setup();
    const { onSortChange } = renderToolbar();

    await user.selectOptions(screen.getByRole('combobox'), 'Highest Rated');
    expect(onSortChange).toHaveBeenCalledWith('rating');

    await user.selectOptions(screen.getByRole('combobox'), 'Newest');
    expect(onSortChange).toHaveBeenLastCalledWith('newest');
  });

  it('asks for a refresh when the refresh button is clicked', async () => {
    const user = userEvent.setup();
    const { onRefresh, onSearchChange, onSortChange } = renderToolbar();

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onSearchChange).not.toHaveBeenCalled();
    expect(onSortChange).not.toHaveBeenCalled();
  });
});
