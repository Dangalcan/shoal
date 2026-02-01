/**
 * Marketplace List Component
 */

import { useState, useEffect } from 'react';
import { useApi } from '../../services/api-context';
import type { MarketplaceEntry } from '../../types';
import { MarketplaceCard } from './MarketplaceCard';
import { Search, RotateCw } from 'lucide-react';
import '../../../styles/components/marketplace/Marketplace.css';

export function MarketplaceList() {
  const api = useApi();
  const [plugins, setPlugins] = useState<MarketplaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const fetchPlugins = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getMarketplacePlugins();
      if (result.success) {
        setPlugins(result.data);
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch plugins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, []);

  const categories = ['All', ...Array.from(new Set(plugins.map(p => p.category)))];

  const filteredPlugins = plugins.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="marketplace-list">
      <div className="marketplace-toolbar">
         <div className="search-bar">
           <Search className="search-icon" size={18} />
           <input
             type="text"
             placeholder="Search plugins..."
             value={search}
             onChange={e => setSearch(e.target.value)}
           />
         </div>

         <div className="category-filter">
            <select 
              value={selectedCategory} 
              onChange={e => setSelectedCategory(e.target.value)}
              className="select-input"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
         </div>

         <button className="btn btn--secondary btn--icon" onClick={fetchPlugins}>
           <RotateCw size={16} /> Refresh
         </button>
      </div>

      {loading && plugins.length === 0 ? (
        <div className="loading-state">
           <span className="spinner"></span>
           <p>Loading marketplace...</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <p>{error}</p>
          <button className="btn btn--secondary" onClick={fetchPlugins}>Try Again</button>
        </div>
      ) : (
        <div className="marketplace-grid">
          {filteredPlugins.map(entry => (
             <MarketplaceCard key={entry.id} entry={entry} />
          ))}
          {filteredPlugins.length === 0 && (
            <div className="empty-state">
              <p>No plugins found matching "{search}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
