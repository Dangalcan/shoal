/**
 * PluginResourceActions
 *
 * Renders the row-action buttons that enabled plugins contribute to a resource
 * table (declared in the manifest as `extensions.resourceActions`). Clicking a
 * button opens the plugin's action component in a sandboxed modal frame, with
 * the selected resource passed as props — no plugin code runs in the host.
 */

import { useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { usePlugins } from './PluginProvider';
import { usePluginModal } from './sandbox/usePluginModal';
import type {
  Plugin,
  ResourceActionWidget,
} from '../../../electron/types/plugin-types';
import type { K8sResource } from '../../types/k8s-types';

interface ResolvedAction {
  plugin: Plugin;
  action: ResourceActionWidget;
}

/** Enabled plugins' resource actions that apply to `resourceType`. */
export function usePluginResourceActions(
  resourceType: string
): ResolvedAction[] {
  const { plugins } = usePlugins();
  return useMemo(() => {
    const out: ResolvedAction[] = [];
    for (const plugin of plugins) {
      if (plugin.state !== 'enabled' || !plugin.rendererEntry) continue;
      for (const action of plugin.manifest.extensions?.resourceActions ?? []) {
        const types = action.resourceTypes ?? [];
        if (types.includes(resourceType) || types.includes('*')) {
          out.push({ plugin, action });
        }
      }
    }
    return out;
  }, [plugins, resourceType]);
}

function ActionIcon({ name }: { name?: string }) {
  const Icon = name
    ? (
        LucideIcons as unknown as Record<
          string,
          React.ComponentType<{ size?: number }>
        >
      )[name]
    : undefined;
  const Fallback = LucideIcons.Puzzle;
  const Cmp = Icon ?? Fallback;
  return <Cmp size={14} />;
}

interface PluginResourceActionsProps {
  resource: K8sResource;
  resourceType: string;
}

export function PluginResourceActions({
  resource,
  resourceType,
}: PluginResourceActionsProps) {
  const actions = usePluginResourceActions(resourceType);
  const { openModal, modalNode } = usePluginModal();

  if (actions.length === 0) return null;

  return (
    <>
      {actions.map(({ plugin, action }) => (
        <button
          key={`${plugin.manifest.id}:${action.id}`}
          className="action-button action-button-plugin"
          title={`${action.label} (${plugin.manifest.name})`}
          onClick={() => openModal(plugin.manifest.id, action.id, { resource })}
        >
          <ActionIcon name={action.icon} />
        </button>
      ))}
      {modalNode}
    </>
  );
}
