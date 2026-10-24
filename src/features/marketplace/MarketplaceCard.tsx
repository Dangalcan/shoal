/**
 * Marketplace Card Component
 */

import {
  Download,
  Check,
  DollarSign,
  User,
  Package,
  ShoppingCart,
  BadgeCheck,
  Clock,
  AlertTriangle,
  X,
} from 'lucide-react';
import type { MarketplaceEntry } from '../../types';
import { activateOnKey } from '../../lib/a11y';
import { StarRating } from './StarRating';
import { useInstallPlugin } from './useInstallPlugin';
import { usePurchasePlugin } from './usePurchasePlugin';
import { getOwnershipState } from './ownership';

interface MarketplaceCardProps {
  entry: MarketplaceEntry;
  featured?: boolean;
  onOpenDetail: (entry: MarketplaceEntry) => void;
}

export function MarketplaceCard({
  entry,
  featured = false,
  onOpenDetail,
}: MarketplaceCardProps) {
  const { isInstalled, hasUpdate, installedPlugin, installing, handleInstall } =
    useInstallPlugin(entry.id, entry.name);
  const { purchasing, awaitingPayment, handlePurchase, cancelPurchase } =
    usePurchasePlugin(entry.id, entry.name);
  const isPaid = entry.price > 0;
  const ownership = getOwnershipState(installedPlugin, isPaid);

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await handleInstall();
  };

  const handleBuyClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await handlePurchase();
  };

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    cancelPurchase();
  };

  const badge = hasUpdate ? (
    <span className="marketplace-card__badge marketplace-card__badge--update">
      Update
    </span>
  ) : ownership === 'licensed' ? (
    <span className="marketplace-card__badge marketplace-card__badge--licensed">
      <BadgeCheck size={10} /> Licensed
    </span>
  ) : ownership === 'trial' ? (
    <span className="marketplace-card__badge marketplace-card__badge--trial">
      <Clock size={10} /> Trial
    </span>
  ) : ownership === 'expired' ? (
    <span className="marketplace-card__badge marketplace-card__badge--expired">
      <AlertTriangle size={10} /> Expired
    </span>
  ) : ownership === 'installed' ? (
    <span className="marketplace-card__badge marketplace-card__badge--installed">
      <Check size={10} /> Installed
    </span>
  ) : null;

  return (
    <div
      className={`marketplace-card ${featured ? 'marketplace-card--featured' : ''}`}
      onClick={() => onOpenDetail(entry)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => activateOnKey(e, () => onOpenDetail(entry))}
    >
      {badge}

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
          <span
            className={`marketplace-card__price ${entry.price === 0 ? 'free' : 'paid'}`}
          >
            {entry.price === 0 ? (
              'Free'
            ) : (
              <>
                <DollarSign size={14} />
                {entry.price}
              </>
            )}
          </span>
        </div>

        {entry.rating !== undefined && (
          <div className="marketplace-card__rating">
            <StarRating
              rating={entry.rating}
              reviews={entry.reviews}
              size={13}
            />
          </div>
        )}
      </div>

      <div className="marketplace-card__footer">
        {purchasing ? (
          <div className="marketplace-card__purchase-row">
            <button className="btn btn--full btn--primary" disabled>
              <span className="spinner spinner--small" />
              {awaitingPayment ? 'Waiting for payment...' : 'Purchasing...'}
            </button>
            {awaitingPayment && (
              <button
                className="btn btn--outline marketplace-card__cancel-btn"
                onClick={handleCancelClick}
                title="Cancel purchase"
              >
                <X size={14} /> Cancel
              </button>
            )}
          </div>
        ) : ownership === 'expired' ? (
          <button
            className="btn btn--full btn--warning"
            onClick={handleBuyClick}
          >
            <ShoppingCart size={16} /> License expired — Buy ${entry.price}
          </button>
        ) : isInstalled && !hasUpdate ? (
          <button className="btn btn--outline btn--full btn--success" disabled>
            {ownership === 'licensed' ? (
              <>
                <BadgeCheck size={16} /> Licensed
              </>
            ) : ownership === 'trial' ? (
              <>
                <Clock size={16} /> Trial active
              </>
            ) : (
              <>
                <Check size={16} /> Installed
              </>
            )}
          </button>
        ) : isPaid && !hasUpdate ? (
          <button
            className="btn btn--full btn--primary"
            onClick={handleBuyClick}
          >
            <ShoppingCart size={16} /> Buy ${entry.price}
          </button>
        ) : (
          <button
            className={`btn btn--full ${hasUpdate ? 'btn--warning' : 'btn--primary'}`}
            onClick={handleInstallClick}
            disabled={installing}
          >
            {installing ? (
              <>
                <span className="spinner spinner--small" /> Installing...
              </>
            ) : hasUpdate ? (
              <>
                <Download size={16} /> Update
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
