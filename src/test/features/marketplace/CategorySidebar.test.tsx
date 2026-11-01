import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategorySidebar } from '../../../features/marketplace/CategorySidebar';

const categories = ['All', 'Monitoring', 'Security', 'Themes'];
const categoryCounts: Record<string, number> = { Monitoring: 3, Security: 1 };

function renderSidebar(selectedCategory = 'All') {
  const onSelect = vi.fn<(cat: string) => void>();
  render(
    <CategorySidebar
      categories={categories}
      categoryCounts={categoryCounts}
      selectedCategory={selectedCategory}
      totalCount={7}
      onSelect={onSelect}
    />
  );
  return { onSelect };
}

/** The sidebar button whose name part reads `name`. */
function categoryButton(name: string): HTMLElement {
  const button = screen.getByText(name).closest('button');
  if (!button) throw new Error(`No category button for ${name}`);
  return button;
}

describe('CategorySidebar', () => {
  it('lists every category in the given order under a Categories title', () => {
    renderSidebar();

    expect(
      screen.getByRole('heading', { name: 'Categories' })
    ).toBeInTheDocument();
    const sidebar = screen.getByRole('complementary');
    // Each button reads "<name><count>".
    expect(
      within(sidebar)
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['All7', 'Monitoring3', 'Security1', 'Themes0']);
  });

  it('shows the total for All, per-category counts, and 0 for a category without a count', () => {
    renderSidebar();

    expect(within(categoryButton('All')).getByText('7')).toBeInTheDocument();
    expect(
      within(categoryButton('Monitoring')).getByText('3')
    ).toBeInTheDocument();
    expect(
      within(categoryButton('Security')).getByText('1')
    ).toBeInTheDocument();
    expect(within(categoryButton('Themes')).getByText('0')).toBeInTheDocument();
  });

  it('marks only the selected category as active', () => {
    renderSidebar('Security');

    expect(categoryButton('Security')).toHaveClass('active');
    expect(categoryButton('All')).not.toHaveClass('active');
    expect(categoryButton('Monitoring')).not.toHaveClass('active');
  });

  it('reports the clicked category', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderSidebar();

    await user.click(categoryButton('Monitoring'));
    expect(onSelect).toHaveBeenCalledWith('Monitoring');

    await user.click(categoryButton('All'));
    expect(onSelect).toHaveBeenLastCalledWith('All');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});
