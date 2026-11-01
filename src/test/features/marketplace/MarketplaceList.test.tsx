import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, userEvent } from '../../utils';
import { createMockElectronAPI } from '../../utils/mocks';
import { mockToast } from '../../mocks/toast-mock';
import type { MarketplaceEntry } from '../../../types';
import type { Result } from '../../../types/result';
import { MarketplaceList } from '../../../features/marketplace/MarketplaceList';

// Popularity score is rating × ln(reviews + 1):
// Prometheus 23.0, Vault 16.7, Log Tailer 7.2, Helm 6.8, Net / Theme 0.
const prometheus: MarketplaceEntry = {
  id: 'prometheus-monitor',
  name: 'Prometheus Monitor',
  version: '1.2.0',
  description: 'Scrape and chart cluster metrics',
  author: 'Obs Team',
  category: 'Monitoring',
  price: 0,
  rating: 4.8,
  reviews: 120,
  tags: ['metrics', 'prometheus'],
};
// No rating, reviews or tags.
const netInspector: MarketplaceEntry = {
  id: 'net-inspector',
  name: 'Net Inspector',
  version: '0.3.0',
  description: 'Trace service traffic',
  author: 'NetOps',
  category: 'Monitoring',
  price: 5,
};
const vault: MarketplaceEntry = {
  id: 'vault-secrets',
  name: 'Vault Secrets',
  version: '2.1.0',
  description: 'Sync secrets from Vault',
  author: 'SecOps',
  category: 'Security',
  price: 29,
  rating: 4.5,
  reviews: 40,
  tags: ['secrets'],
};
const helm: MarketplaceEntry = {
  id: 'helm-manager',
  name: 'Helm Manager',
  version: '2.0.1',
  description: 'Manage Helm releases',
  author: 'DevOps Toolbox',
  category: 'DevTools',
  price: 19,
  rating: 4.9,
  reviews: 3,
  tags: ['charts'],
};
const logTailer: MarketplaceEntry = {
  id: 'log-tailer',
  name: 'Log Tailer',
  version: '1.0.0',
  description: 'Stream container output',
  author: 'Shoal Team',
  category: 'Logging',
  price: 0,
  rating: 3,
  reviews: 10,
};
// Top rating but no reviews: scores 0 for popularity.
const themePack: MarketplaceEntry = {
  id: 'theme-pack',
  name: 'Theme Pack',
  version: '1.0.0',
  description: 'Extra colour themes',
  author: 'Shoal Team',
  category: 'Themes',
  price: 0,
  rating: 5,
};

/** Catalogue order, which the "Newest" sort keeps. */
const catalogue = [prometheus, netInspector, vault, helm, logTailer, themePack];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * Plugin names on the cards of the section whose heading reads `title`
 * (visible text, e.g. "All Plugins (3)"), in order.
 */
function sectionCards(title: string): string[] {
  const heading = screen
    .getAllByRole('heading', { level: 2 })
    .find((h) => h.textContent === title);
  if (!heading) throw new Error(`No section titled ${title}`);
  const section = heading.closest('section');
  if (!section) throw new Error(`No section titled ${title}`);
  return within(section)
    .getAllByRole('heading', { level: 3 })
    .map((h) => h.textContent ?? '');
}

/** Plugin names on every card on screen (the sidebar title excluded). */
function visibleCards(): string[] {
  const sidebar = screen.getByRole('complementary');
  return screen
    .queryAllByRole('heading', { level: 3 })
    .filter((h) => !sidebar.contains(h))
    .map((h) => h.textContent ?? '');
}

describe('MarketplaceList', () => {
  let api: ReturnType<typeof createMockElectronAPI>;

  beforeEach(() => {
    api = createMockElectronAPI();
    api.getMarketplacePlugins.mockResolvedValue({
      success: true,
      data: catalogue,
    });
  });

  const renderList = () => render(<MarketplaceList />, { api });

  it('shows a loading state until the first list arrives', async () => {
    const pending = deferred<Result<MarketplaceEntry[]>>();
    api.getMarketplacePlugins.mockReturnValueOnce(pending.promise);
    renderList();

    expect(screen.getByText('Loading marketplace...')).toBeInTheDocument();
    expect(screen.queryByText('Featured')).not.toBeInTheDocument();

    pending.resolve({ success: true, data: catalogue });

    expect(
      await screen.findByRole('heading', { name: 'Featured' })
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Loading marketplace...')
    ).not.toBeInTheDocument();
  });

  it('features the three most popular plugins and lists the rest under All Plugins', async () => {
    renderList();

    await screen.findByRole('heading', { name: 'Featured' });
    expect(sectionCards('Featured')).toEqual([
      'Prometheus Monitor',
      'Vault Secrets',
      'Log Tailer',
    ]);
    expect(sectionCards('All Plugins (3)')).toEqual([
      'Helm Manager',
      'Net Inspector',
      'Theme Pack',
    ]);
  });

  it('builds the category sidebar from the catalogue with counts', async () => {
    renderList();
    await screen.findByRole('heading', { name: 'Featured' });

    const sidebar = screen.getByRole('complementary');
    expect(
      within(sidebar)
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual([
      'All6',
      'DevTools1',
      'Logging1',
      'Monitoring2',
      'Security1',
      'Themes1',
    ]);
  });

  it.each([
    [
      'rating',
      'Highest Rated',
      ['Theme Pack', 'Helm Manager', 'Net Inspector'],
    ],
    [
      'free-first',
      'Free First',
      ['Theme Pack', 'Net Inspector', 'Helm Manager'],
    ],
    ['newest', 'Newest', ['Net Inspector', 'Helm Manager', 'Theme Pack']],
    [
      'popular',
      'Most Popular',
      ['Helm Manager', 'Net Inspector', 'Theme Pack'],
    ],
  ])(
    'orders the remaining plugins by the %s sort',
    async (_key, label, expected) => {
      const user = userEvent.setup();
      renderList();
      await screen.findByRole('heading', { name: 'Featured' });

      // Pick another sort first so "Most Popular" is a real change too.
      await user.selectOptions(
        screen.getByRole('combobox'),
        label === 'Newest' ? 'Free First' : 'Newest'
      );
      await user.selectOptions(screen.getByRole('combobox'), label);

      expect(sectionCards('All Plugins (3)')).toEqual(expected);
      // The featured row always shows the most popular plugins.
      expect(sectionCards('Featured')).toEqual([
        'Prometheus Monitor',
        'Vault Secrets',
        'Log Tailer',
      ]);
    }
  );

  it('shows only the selected category, without the featured row', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('heading', { name: 'Featured' });

    const sidebar = screen.getByRole('complementary');
    await user.click(within(sidebar).getByText('Monitoring'));

    expect(visibleCards()).toEqual(['Prometheus Monitor', 'Net Inspector']);
    expect(
      screen.queryByRole('heading', { name: 'Featured' })
    ).not.toBeInTheDocument();
    // The grid is headed by the category and its count.
    expect(sectionCards('Monitoring (2)')).toEqual([
      'Prometheus Monitor',
      'Net Inspector',
    ]);
    expect(
      within(sidebar).getByText('Monitoring').closest('button')
    ).toHaveClass('active');

    await user.click(within(sidebar).getByText('All'));
    expect(sectionCards('Featured')).toHaveLength(3);
  });

  it('heads search results with their count', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('heading', { name: 'Featured' });

    await user.type(
      screen.getByPlaceholderText('Search plugins, tags...'),
      'INSPECTOR'
    );

    expect(sectionCards('Search results (1)')).toEqual(['Net Inspector']);
  });

  it('lists a catalogue no larger than the featured row without featuring it', async () => {
    // With three plugins or fewer every plugin used to be featured, and an
    // empty "All Plugins (0)" section said there was nothing in it.
    api.getMarketplacePlugins.mockResolvedValue({
      success: true,
      data: [prometheus, vault, helm],
    });
    renderList();

    await waitFor(() => expect(visibleCards()).toHaveLength(3));
    expect(
      screen.queryByRole('heading', { name: 'Featured' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    expect(
      screen.queryByText('No plugins in this category yet.')
    ).not.toBeInTheDocument();
  });

  it('sorts search results, featured plugins included', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('heading', { name: 'Featured' });

    // "tr" is in the descriptions of Net Inspector, Log Tailer and Theme
    // Pack, and in Prometheus Monitor's "metrics".
    await user.type(
      screen.getByPlaceholderText('Search plugins, tags...'),
      'tr'
    );
    expect(visibleCards()).toEqual([
      'Prometheus Monitor',
      'Log Tailer',
      'Net Inspector',
      'Theme Pack',
    ]);

    await user.selectOptions(screen.getByRole('combobox'), 'Highest Rated');
    expect(visibleCards()).toEqual([
      'Theme Pack',
      'Prometheus Monitor',
      'Log Tailer',
      'Net Inspector',
    ]);
  });

  it.each([
    ['a name', 'INSPECTOR', ['Net Inspector']],
    ['a description', 'container', ['Log Tailer']],
    ['a tag', 'charts', ['Helm Manager']],
  ])(
    'searches case-insensitively by %s and hides the featured row',
    async (_what, query, expected) => {
      const user = userEvent.setup();
      renderList();
      await screen.findByRole('heading', { name: 'Featured' });

      await user.type(
        screen.getByPlaceholderText('Search plugins, tags...'),
        query
      );

      expect(visibleCards()).toEqual(expected);
      expect(
        screen.queryByRole('heading', { name: 'Featured' })
      ).not.toBeInTheDocument();
    }
  );

  it('searches within the selected category only', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('heading', { name: 'Featured' });

    await user.click(
      within(screen.getByRole('complementary')).getByText('Security')
    );
    await user.type(
      screen.getByPlaceholderText('Search plugins, tags...'),
      'charts'
    );

    expect(visibleCards()).toEqual([]);
    expect(
      screen.getByText('No plugins found matching "charts"')
    ).toBeInTheDocument();
  });

  it('says when a search matches nothing', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('heading', { name: 'Featured' });

    await user.type(
      screen.getByPlaceholderText('Search plugins, tags...'),
      'zzz'
    );

    expect(visibleCards()).toEqual([]);
    expect(
      screen.getByText('No plugins found matching "zzz"')
    ).toBeInTheDocument();
  });

  it('shows an empty state for an empty marketplace', async () => {
    api.getMarketplacePlugins.mockResolvedValue({ success: true, data: [] });
    renderList();

    expect(
      await screen.findByText('No plugins in this category yet.')
    ).toBeInTheDocument();
    expect(visibleCards()).toEqual([]);
    expect(
      within(screen.getByRole('complementary'))
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['All0']);
  });

  it('shows the load error and retries on Try Again', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const user = userEvent.setup();
    api.getMarketplacePlugins.mockResolvedValueOnce({
      success: false,
      error: 'Marketplace unreachable',
    });
    renderList();

    expect(
      await screen.findByText('Marketplace unreachable')
    ).toBeInTheDocument();
    expect(mockToast.error).toHaveBeenCalledWith(
      'Failed to load marketplace plugins',
      expect.objectContaining({ description: 'Marketplace unreachable' })
    );

    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(
      await screen.findByRole('heading', { name: 'Featured' })
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Marketplace unreachable')
    ).not.toBeInTheDocument();
    expect(api.getMarketplacePlugins).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  it('keeps the list on screen while a refresh loads, then shows the new list', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('heading', { name: 'Featured' });

    const refreshed = deferred<Result<MarketplaceEntry[]>>();
    api.getMarketplacePlugins.mockReturnValueOnce(refreshed.promise);
    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(
      screen.queryByText('Loading marketplace...')
    ).not.toBeInTheDocument();
    expect(sectionCards('All Plugins (3)')).toHaveLength(3);

    const costExplorer: MarketplaceEntry = {
      id: 'cost-explorer',
      name: 'Cost Explorer',
      version: '0.1.0',
      description: 'Estimate workload spend',
      author: 'FinOps',
      category: 'FinOps',
      price: 0,
    };
    refreshed.resolve({ success: true, data: [...catalogue, costExplorer] });

    await waitFor(() =>
      expect(sectionCards('All Plugins (4)')).toEqual([
        'Helm Manager',
        'Net Inspector',
        'Theme Pack',
        'Cost Explorer',
      ])
    );
    expect(
      within(screen.getByRole('complementary')).getByText('FinOps')
    ).toBeInTheDocument();
    expect(api.getMarketplacePlugins).toHaveBeenCalledTimes(2);
  });

  it('opens the detail modal for a clicked card and closes it again', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('heading', { name: 'Featured' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('heading', { name: 'Vault Secrets' }));

    const dialog = screen.getByRole('dialog', { name: 'Vault Secrets' });
    expect(within(dialog).getByText('by SecOps · v2.1.0')).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', { name: 'Close modal' })
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('heading', { name: 'Theme Pack' }));
    expect(
      screen.getByRole('dialog', { name: 'Theme Pack' })
    ).toBeInTheDocument();
  });
});
