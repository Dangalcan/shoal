/**
 * Marketplace List Component - Odoo-like layout
 *
 * Three-section layout:
 *  Category sidebar | Toolbar (search + sort) | Featured row | All plugins grid
 */

import { useState, useEffect, useMemo } from 'react';
import { useApi } from '../../services/api-context';
import type { MarketplaceEntry } from '../../types';
import { MarketplaceCard } from './MarketplaceCard';
import { PluginDetailModal } from './PluginDetailModal';
import { Search, RotateCw, ChevronDown } from 'lucide-react';
import '../../../styles/components/marketplace/Marketplace.css';

type SortOption = 'popular' | 'rating' | 'free-first' | 'newest';

const SORT_LABELS: Record<SortOption, string> = {
  popular: 'Most Popular',
  rating: 'Highest Rated',
  'free-first': 'Free First',
  newest: 'Newest',
};

function featuredScore(p: MarketplaceEntry): number {
  return (p.rating ?? 0) * Math.log((p.reviews ?? 0) + 1);
}

function sortPlugins(plugins: MarketplaceEntry[], sort: SortOption): MarketplaceEntry[] {
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
  const [plugins, setPlugins] = useState<MarketplaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sort, setSort] = useState<SortOption>('popular');
  const [detailPlugin, setDetailPlugin] = useState<MarketplaceEntry | null>(null);

  const fetchPlugins = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getMarketplacePlugins();
      if (result.success) {
        setPlugins(result.data ?? []);
      } else {
        setError(result.error ?? 'Failed to load plugins');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch plugins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, []);

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
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
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

  // Top 3 featured plugins shown when no filter/search is active
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
        {/* ── Category sidebar ── */}
        <aside className="marketplace-sidebar">
          <h3 className="marketplace-sidebar__title">Categories</h3>
          <ul className="marketplace-sidebar__list">
            {categories.map((cat) => (
              <li key={cat}>
                <button
                  className={
                    'marketplace-sidebar__item' +
                    (selectedCategory === cat ? ' active' : '')
                  }
                  onClick={() => setSelectedCategory(cat)}
                >
                  <span className="marketplace-sidebar__item-name">{cat}</span>
                  <span className="marketplace-sidebar__item-count">
                    {cat === 'All' ? plugins.length : (categoryCounts[cat] ?? 0)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* ── Main content ── */}
        <div className="marketplace-main">
          {/* Toolbar */}
          <div className="marketplace-toolbar">
            <div className="search-bar">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                placeholder="Search plugins, tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="marketplace-toolbar__right">
              <div className="marketplace-sort">
                <ChevronDown size={14} className="marketplace-sort__icon" />
                <select
                  className="select-input"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                >
                  {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                    <option key={key} value={key}>
                      {SORT_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="btn btn--secondary btn--icon"
                onClick={fetchPlugins}
                title="Refresh"
              >
                <RotateCw size={16} />
              </button>
            </div>
          </div>

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
              {/* Featured row */}
              {featuredPlugins.length > 0 && (
                <section className="marketplace-section">
                  <h2 className="marketplace-section__title">Featured</h2>
                  <div className="marketplace-featured">
                    {featuredPlugins.map((entry) => (
                      <MarketplaceCard
                        key={entry.id}
                        entry={entry}
                        featured
                        onOpenDetail={setDetailPlugin}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Regular grid */}
              <section className="marketplace-section">
                {featuredPlugins.length > 0 && (
                  <h2 className="marketplace-section__title">
                    {selectedCategory === 'All' ? 'All Plugins' : selectedCategory}
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
                        onOpenDetail={setDetailPlugin}
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

      {/* Detail modal */}
      {detailPlugin && (
        <PluginDetailModal
          entry={detailPlugin}
          onClose={() => setDetailPlugin(null)}
        />
      )}
    </>
  );
}
