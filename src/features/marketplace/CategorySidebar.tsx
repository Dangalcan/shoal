interface CategorySidebarProps {
  categories: string[];
  categoryCounts: Record<string, number>;
  selectedCategory: string;
  totalCount: number;
  onSelect: (cat: string) => void;
}

export function CategorySidebar({
  categories,
  categoryCounts,
  selectedCategory,
  totalCount,
  onSelect,
}: CategorySidebarProps) {
  return (
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
              onClick={() => onSelect(cat)}
            >
              <span className="marketplace-sidebar__item-name">{cat}</span>
              <span className="marketplace-sidebar__item-count">
                {cat === 'All' ? totalCount : (categoryCounts[cat] ?? 0)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
