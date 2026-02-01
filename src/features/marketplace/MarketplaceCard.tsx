/**
 * Marketplace Card Component
 */

import { Download, Check, DollarSign, User, Package } from 'lucide-react';
import type { MarketplaceEntry } from '../../types';
import { usePlugins } from '../plugins/PluginProvider';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import '../../../styles/components/marketplace/Marketplace.css';

interface MarketplaceCardProps {
  entry: MarketplaceEntry;
}

export function MarketplaceCard({ entry }: MarketplaceCardProps) {
  const { plugins, installPlugin } = usePlugins();
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInstalled = plugins.some(p => p.manifest.id === entry.id);

  const handleInstall = async () => {
    if (isInstalled) return;

    setInstalling(true);
    setError(null);
    const toastId = toast.loading(`Installing ${entry.name}...`);
    
    try {
      await installPlugin(entry.id);
      toast.success(`${entry.name} installed successfully!`, { id: toastId });
      // We don't setInstalling(false) here, we wait for the effect to see the new plugin in the list
    } catch (err: any) {
      const msg = err.message || 'Installation failed';
      setError(msg);
      toast.error(msg, { id: toastId });
      setInstalling(false);
    }
  };

  // Reset local installing state when plugin appears in global list
  useEffect(() => {
    if (isInstalled && installing) {
      setInstalling(false);
    }
  }, [isInstalled, installing, entry.id]);

  return (
    <div className="marketplace-card">
      <div className="marketplace-card__header">
        <div className="marketplace-card__icon">
          {entry.icon ? (
            <img src={entry.icon} alt={entry.name} />
          ) : (
            <div className="marketplace-card__icon-placeholder">
              <Package size={32} />
            </div>
          )}
        </div>
        <div className="marketplace-card__title-row">
           <h3 className="marketplace-card__title">{entry.name}</h3>
           <span className="marketplace-card__version">v{entry.version}</span>
           <div className="marketplace-card__category">{entry.category}</div>
        </div>
      </div>

      <div className="marketplace-card__body">
        <p className="marketplace-card__description">{entry.description}</p>
        
        <div className="marketplace-card__meta">
          <span className="marketplace-card__author">
            <User size={12} style={{ marginRight: '4px', display: 'inline' }} />
            {entry.author}
          </span>
          <span className={`marketplace-card__price ${entry.price === 0 ? 'free' : 'paid'}`}>
             {entry.price === 0 ? 'Free' : (
               <><DollarSign size={14} /> {entry.price}</>
             )}
          </span>
        </div>
        
        {error && <div className="marketplace-card__error">{error}</div>}
      </div>

      <div className="marketplace-card__footer">
        {isInstalled ? (
          <button className="btn btn--outline btn--full btn--success" disabled>
            <Check size={16} /> Installed
          </button>
        ) : (
          <button 
            className="btn btn--primary btn--full"
            onClick={handleInstall}
            disabled={installing}
          >
            {installing ? (
              <>
                <span className="spinner spinner--small"></span> Installing...
              </>
            ) : (
              <>
                <Download size={16} /> Install
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
