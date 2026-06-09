/**
 * Plugin UI Registry
 *
 * Manages UI components registered by plugins (Pages, Widgets, etc.).
 */

import React from 'react';
import type { K8sResource } from '../types/k8s-types';

export interface DashboardWidget {
  id: string;
  pluginId?: string;
  title: string;
  size: 'small' | 'medium' | 'large';
  component: React.ComponentType<any>;
}

export interface PluginPage {
  id: string;
  component: React.ComponentType<any>;
}

export interface ResourceActionExtension {
  id: string;
  label: string;
  icon?: React.ReactNode;
  resourceTypes: string[];
  onClick: (resource: K8sResource) => void;
}

export interface PluginModal {
  id: string;
  component: React.ComponentType<any>;
}

class PluginUIRegistry {
  private widgets: Map<string, DashboardWidget> = new Map();
  private widgetPlugins: Map<string, string> = new Map(); // widgetId → pluginId
  private pages: Map<string, PluginPage> = new Map();
  private resourceActions: Map<string, ResourceActionExtension> = new Map();
  private modals: Map<string, PluginModal> = new Map();
  private listeners: Set<() => void> = new Set();

  registerWidget(widget: DashboardWidget) {
    if (this.widgets.has(widget.id)) {
      console.warn(
        `[PluginUIRegistry] Widget "${widget.id}" already registered — rejected`
      );
      return;
    }
    this.widgets.set(widget.id, widget);
    if (widget.pluginId) {
      this.widgetPlugins.set(widget.id, widget.pluginId);
    }
    this.notify();
  }

  unregisterWidget(widgetId: string) {
    this.widgets.delete(widgetId);
    this.widgetPlugins.delete(widgetId);
    this.notify();
  }

  unregisterWidgetsByPlugin(pluginId: string) {
    let changed = false;
    for (const [widgetId, pid] of this.widgetPlugins.entries()) {
      if (pid === pluginId) {
        this.widgets.delete(widgetId);
        this.widgetPlugins.delete(widgetId);
        changed = true;
      }
    }
    if (changed) this.notify();
  }

  registerPage(page: PluginPage) {
    if (this.pages.has(page.id)) {
      console.warn(
        `[PluginUIRegistry] Page "${page.id}" already registered — rejected`
      );
      return;
    }
    this.pages.set(page.id, page);
    this.notify();
  }

  unregisterPage(pageId: string) {
    this.pages.delete(pageId);
    this.notify();
  }

  registerResourceAction(action: ResourceActionExtension) {
    if (this.resourceActions.has(action.id)) {
      console.warn(
        `[PluginUIRegistry] ResourceAction "${action.id}" already registered — rejected`
      );
      return;
    }
    this.resourceActions.set(action.id, action);
    this.notify();
  }

  unregisterResourceAction(actionId: string) {
    this.resourceActions.delete(actionId);
    this.notify();
  }

  registerModal(modal: PluginModal) {
    if (this.modals.has(modal.id)) {
      console.warn(
        `[PluginUIRegistry] Modal "${modal.id}" already registered — rejected`
      );
      return;
    }
    this.modals.set(modal.id, modal);
  }

  unregisterModal(modalId: string) {
    this.modals.delete(modalId);
  }

  getModal(modalId: string): PluginModal | undefined {
    return this.modals.get(modalId);
  }

  getWidgets(): DashboardWidget[] {
    return Array.from(this.widgets.values());
  }

  getPage(pageId: string): PluginPage | undefined {
    return this.pages.get(pageId);
  }

  getResourceActions(resourceType: string): ResourceActionExtension[] {
    return Array.from(this.resourceActions.values()).filter(
      (a) =>
        a.resourceTypes.includes(resourceType) || a.resourceTypes.includes('*')
    );
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

export const pluginUIRegistry = new PluginUIRegistry();

// Expose registry globally for external plugins
declare global {
  interface Window {
    pluginUIRegistry: PluginUIRegistry;
  }
}
window.pluginUIRegistry = pluginUIRegistry;

// ---------------------------------------------------------------------------
// Plugin Script State Tracker
// Tracks whether a plugin's renderer script is loading, loaded, or failed.
// Used by PluginRuntime (writes) and PluginPage (reads).
// ---------------------------------------------------------------------------

export type PluginScriptStatus = 'loading' | 'loaded' | 'error';

class PluginScriptTracker {
  private statuses: Map<string, PluginScriptStatus> = new Map();
  private listeners: Set<() => void> = new Set();

  setStatus(pluginId: string, status: PluginScriptStatus) {
    this.statuses.set(pluginId, status);
    this.listeners.forEach((l) => l());
  }

  getStatus(pluginId: string): PluginScriptStatus | undefined {
    return this.statuses.get(pluginId);
  }

  clear(pluginId: string) {
    this.statuses.delete(pluginId);
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const pluginScriptTracker = new PluginScriptTracker();

export function usePluginScriptStatus(
  pluginId: string
): PluginScriptStatus | undefined {
  const [status, setStatus] = React.useState(
    pluginScriptTracker.getStatus(pluginId)
  );

  React.useEffect(() => {
    setStatus(pluginScriptTracker.getStatus(pluginId));
    const unsubscribe = pluginScriptTracker.subscribe(() => {
      setStatus(pluginScriptTracker.getStatus(pluginId));
    });
    return () => {
      unsubscribe();
    };
  }, [pluginId]);

  return status;
}

// Hook for React
export function usePluginWidgets() {
  const [widgets, setWidgets] = React.useState(pluginUIRegistry.getWidgets());

  React.useEffect(() => {
    const cleanup = pluginUIRegistry.subscribe(() => {
      setWidgets(pluginUIRegistry.getWidgets());
    });
    return () => {
      cleanup();
    };
  }, []);

  return widgets;
}

export function useResourceActions(resourceType: string) {
  const [actions, setActions] = React.useState(
    pluginUIRegistry.getResourceActions(resourceType)
  );

  React.useEffect(() => {
    setActions(pluginUIRegistry.getResourceActions(resourceType));
    const cleanup = pluginUIRegistry.subscribe(() => {
      setActions(pluginUIRegistry.getResourceActions(resourceType));
    });
    return () => {
      cleanup();
    };
  }, [resourceType]);

  return actions;
}

export function usePluginPage(pageId: string) {
  const [page, setPage] = React.useState(pluginUIRegistry.getPage(pageId));

  React.useEffect(() => {
    setPage(pluginUIRegistry.getPage(pageId));
    const cleanup = pluginUIRegistry.subscribe(() => {
      setPage(pluginUIRegistry.getPage(pageId));
    });
    return () => {
      cleanup();
    };
  }, [pageId]);

  return page;
}
