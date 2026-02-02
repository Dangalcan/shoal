/**
 * Plugin UI Registry
 *
 * Manages UI components registered by plugins (Pages, Widgets, etc.).
 */

import React from 'react';

export interface DashboardWidget {
  id: string;
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
  onClick: (resource: any) => void;
}

class PluginUIRegistry {
  private widgets: Map<string, DashboardWidget> = new Map();
  private pages: Map<string, PluginPage> = new Map();
  private resourceActions: Map<string, ResourceActionExtension> = new Map();
  private listeners: Set<() => void> = new Set();

  registerWidget(widget: DashboardWidget) {
    this.widgets.set(widget.id, widget);
    this.notify();
  }

  unregisterWidget(widgetId: string) {
    this.widgets.delete(widgetId);
    this.notify();
  }

  registerPage(page: PluginPage) {
    this.pages.set(page.id, page);
    this.notify();
  }

  unregisterPage(pageId: string) {
    this.pages.delete(pageId);
    this.notify();
  }

  registerResourceAction(action: ResourceActionExtension) {
    this.resourceActions.set(action.id, action);
    this.notify();
  }

  unregisterResourceAction(actionId: string) {
    this.resourceActions.delete(actionId);
    this.notify();
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
(window as any).pluginUIRegistry = pluginUIRegistry;

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
    const cleanup = pluginUIRegistry.subscribe(() => {
      setActions(pluginUIRegistry.getResourceActions(resourceType));
    });
    return () => {
      cleanup();
    };
  }, [resourceType]);

  return actions;
}
