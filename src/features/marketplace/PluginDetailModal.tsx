import { useState } from 'react';
import { Download, Check, X, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MarketplaceEntry } from '../../types';
import { StarRating } from './StarRating';
import { useInstallPlugin } from './useInstallPlugin';
import '../../../styles/components/modals/BaseModal.css';

interface PluginDetailModalProps {
  entry: MarketplaceEntry;
  onClose: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Monitoring: '#0ea5e9',
  Security: '#16a34a',
  DevTools: '#d97706',
  Networking: '#0284c7',
  Logging: '#f59e0b',
  Storage: '#8b5cf6',
  'CI/CD': '#06b6d4',
  Themes: '#ec4899',
};

const PERMISSION_LABELS: Record<string, { label: string; description: string }> = {
  kubernetes: { label: 'Kubernetes API', description: 'Read and write Kubernetes resources' },
  ui: { label: 'UI Extensions', description: 'Add sidebar items and custom pages' },
  storage: { label: 'Local Storage', description: 'Store persistent data on this machine' },
  notifications: { label: 'Notifications', description: 'Show desktop notifications' },
  filesystem: { label: 'File System', description: 'Read and write local files' },
  network: { label: 'Network Access', description: 'Make outbound network requests' },
};

export function PluginDetailModal({ entry, onClose }: PluginDetailModalProps) {
  const { isInstalled, installing, handleInstall } = useInstallPlugin(entry.id, entry.name);
  const [activeScreenshot, setActiveScreenshot] = useState(0);

  const screenshots = entry.screenshots ?? [];
  const tags = entry.tags ?? [];
  const categoryColor = CATEGORY_COLORS[entry.category] ?? 'var(--color-primary)';

  const prevScreenshot = () =>
    setActiveScreenshot((i) => (i - 1 + screenshots.length) % screenshots.length);
  const nextScreenshot = () =>
    setActiveScreenshot((i) => (i + 1) % screenshots.length);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container plugin-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="plugin-detail-modal__title-row">
            <div
              className="plugin-detail-modal__icon"
              style={{ background: `${categoryColor}22`, border: `1px solid ${categoryColor}44` }}
            >
              {entry.icon ? (
                <img src={entry.icon} alt={entry.name} width={40} height={40} />
              ) : (
                <Package size={32} style={{ color: categoryColor }} />
              )}
            </div>
            <div>
              <h2 className="modal-title">{entry.name}</h2>
              <span className="modal-subtitle">by {entry.author} · v{entry.version}</span>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body plugin-detail-modal__body">
          {/* Left column */}
          <div className="plugin-detail-modal__left">
            {/* Screenshots gallery */}
            {screenshots.length > 0 && (
              <div className="plugin-detail-modal__gallery">
                <div className="plugin-detail-modal__gallery-main">
                  <img
                    src={screenshots[activeScreenshot]}
                    alt={`${entry.name} screenshot ${activeScreenshot + 1}`}
                    className="plugin-detail-modal__screenshot"
                  />
                  {screenshots.length > 1 && (
                    <>
                      <button
                        className="plugin-detail-modal__gallery-nav prev"
                        onClick={prevScreenshot}
                        aria-label="Previous screenshot"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        className="plugin-detail-modal__gallery-nav next"
                        onClick={nextScreenshot}
                        aria-label="Next screenshot"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </>
                  )}
                </div>
                {screenshots.length > 1 && (
                  <div className="plugin-detail-modal__thumbnails">
                    {screenshots.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt={`Screenshot ${i + 1}`}
                        className={`plugin-detail-modal__thumb ${i === activeScreenshot ? 'active' : ''}`}
                        onClick={() => setActiveScreenshot(i)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Long description */}
            <div className="plugin-detail-modal__description">
              <h3>About</h3>
              <p>{entry.longDescription || entry.description}</p>
            </div>

            {/* Changelog */}
            {entry.changelog && (
              <div className="plugin-detail-modal__changelog">
                <h3>What's New</h3>
                <pre>{entry.changelog}</pre>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="plugin-detail-modal__right">
            {/* Category badge */}
            <div
              className="plugin-detail-modal__category-badge"
              style={{ background: `${categoryColor}22`, color: categoryColor, border: `1px solid ${categoryColor}44` }}
            >
              {entry.category}
            </div>

            {/* Rating */}
            {entry.rating !== undefined && (
              <div className="plugin-detail-modal__rating">
                <StarRating rating={entry.rating} reviews={entry.reviews} size={16} />
              </div>
            )}

            {/* Price */}
            <div className="plugin-detail-modal__price">
              {entry.price === 0 ? (
                <span className="price-free">Free</span>
              ) : (
                <span className="price-paid">${entry.price}</span>
              )}
            </div>

            {/* Install button */}
            <div className="plugin-detail-modal__actions">
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
                    <><span className="spinner spinner--small" /> Installing...</>
                  ) : (
                    <><Download size={16} /> {entry.price > 0 ? 'Buy & Install' : 'Install'}</>
                  )}
                </button>
              )}
            </div>


            {/* Tags */}
            {tags.length > 0 && (
              <div className="plugin-detail-modal__tags">
                <h4>Tags</h4>
                <div className="plugin-detail-modal__tag-list">
                  {tags.map((tag) => (
                    <span key={tag} className="plugin-detail-modal__tag">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Permissions */}
            {entry.manifest?.permissions && entry.manifest.permissions.length > 0 && (
              <div className="plugin-detail-modal__permissions">
                <h4>Permissions</h4>
                {entry.manifest.permissions.map((perm) => {
                  const info = PERMISSION_LABELS[perm] ?? { label: perm, description: '' };
                  return (
                    <div key={perm} className="plugin-detail-modal__permission-item">
                      <span className="plugin-detail-modal__permission-label">{info.label}</span>
                      <span className="plugin-detail-modal__permission-desc">{info.description}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
