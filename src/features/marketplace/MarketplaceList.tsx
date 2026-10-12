/**
 * Marketplace List Component - Odoo-like layout
 *
 * Three-section layout:
 *  Category sidebar | Toolbar (search + sort) | Featured row | All plugins grid
 */

import { useState, useMemo } from 'react';
import { useApi } from '../../services/api-context';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useItemModal } from '../../hooks/useItemModal';
import type { MarketplaceEntry } from '../../types';
import { MarketplaceCard } from './MarketplaceCard';
import { PluginDetailModal } from './PluginDetailModal';
import { CategorySidebar } from './CategorySidebar';
import { MarketplaceToolbar } from './MarketplaceToolbar';
import type { SortOption } from './MarketplaceToolbar';

function featuredScore(p: MarketplaceEntry): number {
  return (p.rating ?? 0) * Math.log((p.reviews ?? 0) + 1);
}

function sortPlugins(
  plugins: MarketplaceEntry[],
  sort: SortOption
): MarketplaceEntry[] {
  const copy = [...plugins];
  switch (sort) {
    case 'popular':
      return copy.sort((a, b) => featuredScore(b) - featuredScore(a));
    case 'rating':
      return copy.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case 'free-first':
      return copy.sort((a, b) => a.price - b.price);
    case 'newest':
      return copy;
  }
}

export function MarketplaceList() {
  const api = useApi();
  const {
    data: pluginsData,
    loading,
    error,
    refetch: fetchPlugins,
  } = useAsyncData<MarketplaceEntry[]>({
    fetchFn: () => api.getMarketplacePlugins(),
    errorTitle: 'Failed to load marketplace plugins',
  });
  const plugins = pluginsData ?? [];
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sort, setSort] = useState<SortOption>('popular');
  const detailModal = useItemModal<MarketplaceEntry>();

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of plugins) {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
    }
    return counts;
  }, [plugins]);

  const categories = useMemo(
    () => ['All', ...Object.keys(categoryCounts).sort()],
    [categoryCounts]
  );

  const filtered = useMemo(() => {
    const result = plugins.filter((p) => {
      if (selectedCategory !== 'All' && p.category !== selectedCategory)
        return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
    return sortPlugins(result, sort);
  }, [plugins, selectedCategory, search, sort]);

  const featuredPlugins = useMemo(
    () =>
      selectedCategory === 'All' && !search
        ? sortPlugins([...plugins], 'popular').slice(0, 3)
        : [],
    [plugins, selectedCategory, search]
  );

  const regularPlugins = useMemo(() => {
    const featuredIds = new Set(featuredPlugins.map((p) => p.id));
    return filtered.filter((p) => !featuredIds.has(p.id));
  }, [filtered, featuredPlugins]);

  return (
    <>
      <div className="marketplace-layout">
        <CategorySidebar
          categories={categories}
          categoryCounts={categoryCounts}
          selectedCategory={selectedCategory}
          totalCount={plugins.length}
          onSelect={setSelectedCategory}
        />

        <div className="marketplace-main">
          <MarketplaceToolbar
            search={search}
            sort={sort}
            onSearchChange={setSearch}
            onSortChange={setSort}
            onRefresh={fetchPlugins}
          />

          {loading && plugins.length === 0 ? (
            <div className="loading-state">
              <span className="spinner" />
              <p>Loading marketplace...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p>{error}</p>
              <button className="btn btn--secondary" onClick={fetchPlugins}>
                Try Again
              </button>
            </div>
          ) : (
            <>
              {featuredPlugins.length > 0 && (
                <section className="marketplace-section">
                  <h2 className="marketplace-section__title">Featured</h2>
                  <div className="marketplace-featured">
                    {featuredPlugins.map((entry) => (
                      <MarketplaceCard
                        key={entry.id}
                        entry={entry}
                        featured
                        onOpenDetail={detailModal.open}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section className="marketplace-section">
                {featuredPlugins.length > 0 && (
                  <h2 className="marketplace-section__title">
                    {selectedCategory === 'All'
                      ? 'All Plugins'
                      : selectedCategory}
                    <span className="marketplace-section__count">
                      {' '}
                      ({regularPlugins.length})
                    </span>
                  </h2>
                )}
                {regularPlugins.length > 0 ? (
                  <div className="marketplace-grid">
                    {regularPlugins.map((entry) => (
                      <MarketplaceCard
                        key={entry.id}
                        entry={entry}
                        onOpenDetail={detailModal.open}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>
                      {search
                        ? `No plugins found matching "${search}"`
                        : 'No plugins in this category yet.'}
                    </p>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {detailModal.item && (
        <PluginDetailModal
          entry={detailModal.item}
          onClose={detailModal.close}
        />
      )}
    </>
  );
}
