import { Search, RotateCw, ChevronDown } from 'lucide-react';

export type SortOption = 'popular' | 'rating' | 'free-first' | 'newest';

export const SORT_LABELS: Record<SortOption, string> = {
  popular: 'Most Popular',
  rating: 'Highest Rated',
  'free-first': 'Free First',
  newest: 'Newest',
};

interface MarketplaceToolbarProps {
  search: string;
  sort: SortOption;
  onSearchChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
  onRefresh: () => void;
}

export function MarketplaceToolbar({
  search,
  sort,
  onSearchChange,
  onSortChange,
  onRefresh,
}: MarketplaceToolbarProps) {
  return (
    <div className="marketplace-toolbar">
      <div className="search-bar">
        <Search className="search-icon" size={18} />
        <input
          type="text"
          placeholder="Search plugins, tags..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="marketplace-toolbar__right">
        <div className="marketplace-sort">
          <ChevronDown size={14} className="marketplace-sort__icon" />
          <select
            className="select-input"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
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
          onClick={onRefresh}
          title="Refresh"
        >
          <RotateCw size={16} />
        </button>
      </div>
    </div>
  );
}
