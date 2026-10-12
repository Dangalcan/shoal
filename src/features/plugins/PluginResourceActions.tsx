/**
 * PluginResourceActions
 *
 * Renders the row-action buttons that enabled plugins contribute to a resource
 * table (declared in the manifest as `extensions.resourceActions`). Clicking a
 * button opens the plugin's action component in a sandboxed modal frame, with
 * the selected resource passed as props — no plugin code runs in the host.
 */

import { useMemo } from 'react';
import type { ComponentType } from 'react';
import {
  Activity,
  AlertCircle,
  Bell,
  Box,
  Database,
  Download,
  Eye,
  FileText,
  Globe,
  Info,
  Key,
  Layers,
  Link,
  Lock,
  Play,
  Puzzle,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Terminal,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
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

/**
 * Icons a resource action may name in its manifest (`icon`). A named set
 * keeps the whole Lucide library out of the main bundle; anything else
 * falls back to the puzzle piece.
 */
export const RESOURCE_ACTION_ICONS: Record<
  string,
  ComponentType<{ size?: number }>
> = {
  Activity,
  AlertCircle,
  Bell,
  Box,
  Database,
  Download,
  Eye,
  FileText,
  Globe,
  Info,
  Key,
  Layers,
  Link,
  Lock,
  Play,
  Puzzle,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Terminal,
  Trash2,
  Upload,
  Zap,
};

function ActionIcon({ name }: { name?: string }) {
  const Cmp = (name && RESOURCE_ACTION_ICONS[name]) || Puzzle;
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
