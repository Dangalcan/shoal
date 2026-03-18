/**
 * Marketplace Card Component
 */

import { Download, Check, DollarSign, User, Package } from 'lucide-react';
import type { MarketplaceEntry } from '../../types';
import { StarRating } from './StarRating';
import { useInstallPlugin } from './useInstallPlugin';


interface MarketplaceCardProps {
  entry: MarketplaceEntry;
  featured?: boolean;
  onOpenDetail: (entry: MarketplaceEntry) => void;
}

export function MarketplaceCard({ entry, featured = false, onOpenDetail }: MarketplaceCardProps) {
  const { isInstalled, hasUpdate, installing, error, handleInstall } = useInstallPlugin(
    entry.id,
    entry.name
  );

  const handleInstallClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleInstall();
  };

  return (
    <div
      className={`marketplace-card ${featured ? 'marketplace-card--featured' : ''}`}
      onClick={() => onOpenDetail(entry)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpenDetail(entry)}
    >
      {hasUpdate && (
        <span className="marketplace-card__badge marketplace-card__badge--update">Update</span>
      )}
      {isInstalled && !hasUpdate && (
        <span className="marketplace-card__badge marketplace-card__badge--installed">
          <Check size={10} /> Installed
        </span>
      )}

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
            {entry.price === 0 ? 'Free' : <><DollarSign size={14} />{entry.price}</>}
          </span>
        </div>

        {entry.rating !== undefined && (
          <div className="marketplace-card__rating">
            <StarRating rating={entry.rating} reviews={entry.reviews} size={13} />
          </div>
        )}

        {error && <div className="marketplace-card__error">{error}</div>}
      </div>

      <div className="marketplace-card__footer">
        {isInstalled && !hasUpdate ? (
          <button
            className="btn btn--outline btn--full btn--success"
            disabled
          >
            <Check size={16} /> Installed
          </button>
        ) : (
          <button
            className={`btn btn--full ${hasUpdate ? 'btn--warning' : 'btn--primary'}`}
            onClick={handleInstallClick}
            disabled={installing}
          >
            {installing ? (
              <><span className="spinner spinner--small" /> Installing...</>
            ) : hasUpdate ? (
              <><Download size={16} /> Update</>
            ) : (
              <><Download size={16} /> Install</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
