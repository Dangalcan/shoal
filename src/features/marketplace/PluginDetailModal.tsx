import { useState } from 'react';
import { Download, Check, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MarketplaceEntry } from '../../types';
import { StarRating } from './StarRating';
import { useInstallPlugin } from './useInstallPlugin';
import { BaseModal } from '../../components/modals/BaseModal';


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

  const pluginIcon = (
    <div
      className="plugin-detail-modal__icon"
      style={{ background: `${categoryColor}22`, border: `1px solid ${categoryColor}44` }}
    >
      {entry.icon ? (
        <img src={entry.icon} alt={entry.name} width={32} height={32} />
      ) : (
        <Package size={24} style={{ color: categoryColor }} />
      )}
    </div>
  );

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={entry.name}
      subtitle={`by ${entry.author} · v${entry.version}`}
      icon={pluginIcon}
      className="plugin-detail-modal"
      maxWidth="760px"
    >
      <div className="plugin-detail-modal__body">
        {/* Gallery — full width at top */}
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

        {/* Meta strip: category · rating · price */}
        <div className="plugin-detail-modal__meta-row">
          <div
            className="plugin-detail-modal__category-badge"
            style={{ background: `${categoryColor}22`, color: categoryColor, border: `1px solid ${categoryColor}44` }}
          >
            {entry.category}
          </div>
          {entry.rating !== undefined && (
            <StarRating rating={entry.rating} reviews={entry.reviews} size={16} />
          )}
          <div className="plugin-detail-modal__price">
            {entry.price === 0 ? (
              <span className="price-free">Free</span>
            ) : (
              <span className="price-paid">${entry.price}</span>
            )}
          </div>
        </div>

        {/* Install action */}
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
    </BaseModal>
  );
}
