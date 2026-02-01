import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { pluginUIRegistry, usePluginWidgets, useResourceActions, DashboardWidget, PluginPage, ResourceActionExtension } from '../../services/plugin-ui-registry';

describe('PluginUIRegistry', () => {
  // Clear registry before each test
  beforeEach(() => {
    // We need to access private properties or provide a clear method if not available.
    // Since we're testing a singleton, we might need to manually clear it if no clear method exists.
    // Looking at the code, there are no clear methods.
    // However, we can use the public unregister methods to clean up, or rely on creating unique IDs for success.
    
    // Ideally, we would add a clear method to the class for testing, but let's try to stick to the interface first.
    // For the purpose of isolated tests, we can just use new IDs.
    
    // BUT, the registry seems to be a singleton exported instance.
    // Let's check if we can reset it. The class is exported but not used directly in the hook, the instance is.
    // Maybe we can access the private maps via type casting for cleanup? 'any' casing.
    (pluginUIRegistry as any).widgets = new Map();
    (pluginUIRegistry as any).pages = new Map();
    (pluginUIRegistry as any).resourceActions = new Map();
    (pluginUIRegistry as any).listeners = new Set();
  });

  describe('Widgets Management', () => {
    it('should register and retrieve widgets', () => {
      const widget: DashboardWidget = {
        id: 'test-widget',
        title: 'Test Widget',
        size: 'small',
        component: () => <div>Test</div>
      };

      pluginUIRegistry.registerWidget(widget);
      expect(pluginUIRegistry.getWidgets()).toContain(widget);
    });

    it('should unregister widgets', () => {
      const widget: DashboardWidget = {
        id: 'test-widget',
        title: 'Test Widget',
        size: 'small',
        component: () => <div>Test</div>
      };

      pluginUIRegistry.registerWidget(widget);
      pluginUIRegistry.unregisterWidget(widget.id);
      expect(pluginUIRegistry.getWidgets()).not.toContain(widget);
    });
  });

  describe('Pages Management', () => {
    it('should register and retrieve pages', () => {
      const page: PluginPage = {
        id: 'test-page',
        component: () => <div>Page</div>
      };

      pluginUIRegistry.registerPage(page);
      expect(pluginUIRegistry.getPage(page.id)).toBe(page);
    });

    it('should return undefined for non-existent page', () => {
      expect(pluginUIRegistry.getPage('non-existent')).toBeUndefined();
    });

    it('should unregister pages', () => {
      const page: PluginPage = {
        id: 'test-page',
        component: () => <div>Page</div>
      };

      pluginUIRegistry.registerPage(page);
      pluginUIRegistry.unregisterPage(page.id);
      expect(pluginUIRegistry.getPage(page.id)).toBeUndefined();
    });
  });

  describe('Resource Actions Management', () => {
    it('should register and retrieve resource actions', () => {
      const action: ResourceActionExtension = {
        id: 'test-action',
        label: 'Test Action',
        resourceTypes: ['pods'],
        onClick: vi.fn()
      };

      pluginUIRegistry.registerResourceAction(action);
      
      const podActions = pluginUIRegistry.getResourceActions('pods');
      expect(podActions).toContain(action);
      
      const serviceActions = pluginUIRegistry.getResourceActions('services');
      expect(serviceActions).not.toContain(action);
    });

    it('should handle wildcard resource types', () => {
      const action: ResourceActionExtension = {
        id: 'all-action',
        label: 'All Action',
        resourceTypes: ['*'],
        onClick: vi.fn()
      };

      pluginUIRegistry.registerResourceAction(action);
      
      expect(pluginUIRegistry.getResourceActions('pods')).toContain(action);
      expect(pluginUIRegistry.getResourceActions('deployments')).toContain(action);
    });

    it('should unregister resource actions', () => {
      const action: ResourceActionExtension = {
        id: 'test-action',
        label: 'Test Action',
        resourceTypes: ['pods'],
        onClick: vi.fn()
      };

      pluginUIRegistry.registerResourceAction(action);
      pluginUIRegistry.unregisterResourceAction(action.id);
      expect(pluginUIRegistry.getResourceActions('pods')).not.toContain(action);
    });
  });

  describe('Subscription System', () => {
    it('should notify listeners on changes', () => {
      const listener = vi.fn();
      const unsubscribe = pluginUIRegistry.subscribe(listener);

      const widget: DashboardWidget = {
        id: 'test-widget',
        title: 'Test',
        size: 'small',
        component: () => <div>Test</div>
      };

      pluginUIRegistry.registerWidget(widget);
      expect(listener).toHaveBeenCalledTimes(1);

      pluginUIRegistry.unregisterWidget(widget.id);
      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
      pluginUIRegistry.registerWidget(widget);
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe('Hooks', () => {
    it('usePluginWidgets should return current widgets and update on change', async () => {
      const widget: DashboardWidget = {
        id: 'hook-widget',
        title: 'Hook Widget',
        size: 'large',
        component: () => <div>Hook</div>
      };

      const { result } = renderHook(() => usePluginWidgets());
      
      expect(result.current).toEqual([]);

      act(() => {
        pluginUIRegistry.registerWidget(widget);
      });

      expect(result.current).toContain(widget);
      
      act(() => {
        pluginUIRegistry.unregisterWidget(widget.id);
      });
      
      expect(result.current).not.toContain(widget);
    });

    it('useResourceActions should return current actions and update on change', () => {
      const action: ResourceActionExtension = {
        id: 'hook-action',
        label: 'Hook Action',
        resourceTypes: ['nodes'],
        onClick: vi.fn()
      };

      const { result } = renderHook(() => useResourceActions('nodes'));
      
      expect(result.current).toEqual([]);

      act(() => {
        pluginUIRegistry.registerResourceAction(action);
      });

      expect(result.current).toContain(action);

      act(() => {
        pluginUIRegistry.unregisterResourceAction(action.id);
      });
      
      expect(result.current).not.toContain(action);
    });
  });
});
