/**
 * Dashboard Widgets
 *
 * Renders each enabled plugin's declared dashboard widgets. Every widget runs
 * in its own sandboxed iframe (PluginFrame with a widget view) — no plugin code
 * executes in the host realm. Widget metadata (id/title/size) comes from the
 * plugin manifest, so the host knows what to render without running the plugin.
 */

import { Card, Animate } from '../../components/ui';
import { usePlugins } from './PluginProvider';
import { PluginFrame } from './sandbox/PluginFrame';
import { buildPluginFrameUrls } from './sandbox/frame-props';
import { usePluginModal } from './sandbox/usePluginModal';
import type { Plugin, WidgetExtension } from '../../../electron/types/plugin-types';

interface ResolvedWidget {
  plugin: Plugin;
  widget: WidgetExtension;
}

function useDashboardWidgets(): ResolvedWidget[] {
  const { plugins } = usePlugins();
  const resolved: ResolvedWidget[] = [];
  for (const plugin of plugins) {
    if (plugin.state !== 'enabled' || !plugin.rendererEntry) continue;
    for (const widget of plugin.manifest.extensions?.widgets ?? []) {
      resolved.push({ plugin, widget });
    }
  }
  return resolved;
}

export function DashboardWidgets() {
  const widgets = useDashboardWidgets();
  const { openModal, modalNode } = usePluginModal();
  if (widgets.length === 0) return null;

  return (
    <div className="dashboard-widgets-section">
      <Animate type="fade" delay={600}>
        <h3 className="section-title">Plugin Widgets</h3>
      </Animate>
      <div className="widgets-grid">
        {widgets.map(({ plugin, widget }, index) => {
          const urls = buildPluginFrameUrls(plugin);
          if (!urls) return null;
          return (
            <Animate
              key={`${plugin.manifest.id}:${widget.id}`}
              type="slide-up"
              delay={600 + index * 100}
            >
              <Card
                title={widget.title}
                className={`widget-card widget-${widget.size}`}
              >
                <PluginFrame
                  pluginId={plugin.manifest.id}
                  hostDocumentUrl={urls.hostDocumentUrl}
                  entryUrl={urls.entryUrl}
                  styleUrls={urls.styleUrls}
                  permissions={urls.permissions}
                  view={{ kind: 'widget', widgetId: widget.id }}
                  onOpenModal={(modalId, props) =>
                    openModal(plugin.manifest.id, modalId, props)
                  }
                />
              </Card>
            </Animate>
          );
        })}
      </div>
      {modalNode}
    </div>
  );
}
