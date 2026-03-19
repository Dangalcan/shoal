import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { pluginUIRegistry, usePluginWidgets, useResourceActions, usePluginPage, usePluginScriptStatus, pluginScriptTracker, DashboardWidget, PluginPage, ResourceActionExtension, PluginModal } from '../../services/plugin-ui-registry';

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

    it('should unregister widgets by plugin ID', () => {
      const widget1: DashboardWidget = {
        id: 'w1',
        pluginId: 'p1',
        title: 'W1',
        size: 'small',
        component: () => null
      };
      const widget2: DashboardWidget = {
        id: 'w2',
        pluginId: 'p2',
        title: 'W2',
        size: 'small',
        component: () => null
      };
      const widget3: DashboardWidget = {
        id: 'w3',
        pluginId: 'p1',
        title: 'W3',
        size: 'small',
        component: () => null
      };

      pluginUIRegistry.registerWidget(widget1);
      pluginUIRegistry.registerWidget(widget2);
      pluginUIRegistry.registerWidget(widget3);

      pluginUIRegistry.unregisterWidgetsByPlugin('p1');

      const widgets = pluginUIRegistry.getWidgets();
      expect(widgets).not.toContain(widget1);
      expect(widgets).toContain(widget2);
      expect(widgets).not.toContain(widget3);
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

  describe('Modals Management', () => {
    it('should register, retrieve and unregister modals', () => {
      const modal: PluginModal = {
        id: 'test-modal',
        component: () => <div>Modal</div>
      };

      pluginUIRegistry.registerModal(modal);
      expect(pluginUIRegistry.getModal(modal.id)).toBe(modal);

      pluginUIRegistry.unregisterModal(modal.id);
      expect(pluginUIRegistry.getModal(modal.id)).toBeUndefined();
    });
  });

  describe('PluginScriptTracker', () => {
    beforeEach(() => {
      (pluginScriptTracker as any).statuses = new Map();
      (pluginScriptTracker as any).listeners = new Set();
    });

    it('should set and get status', () => {
      pluginScriptTracker.setStatus('p1', 'loading');
      expect(pluginScriptTracker.getStatus('p1')).toBe('loading');
      
      pluginScriptTracker.setStatus('p1', 'loaded');
      expect(pluginScriptTracker.getStatus('p1')).toBe('loaded');
    });

    it('should clear status', () => {
      pluginScriptTracker.setStatus('p1', 'loading');
      pluginScriptTracker.clear('p1');
      expect(pluginScriptTracker.getStatus('p1')).toBeUndefined();
    });

    it('should notify listeners on status change', () => {
      const listener = vi.fn();
      pluginScriptTracker.subscribe(listener);
      
      pluginScriptTracker.setStatus('p1', 'loading');
      expect(listener).toHaveBeenCalled();
      
      pluginScriptTracker.clear('p1');
      expect(listener).toHaveBeenCalledTimes(2);
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

    it('usePluginPage should track page changes', () => {
      const page: PluginPage = { id: 'p1', component: () => null };
      const { result } = renderHook(() => usePluginPage('p1'));
      
      expect(result.current).toBeUndefined();

      act(() => {
        pluginUIRegistry.registerPage(page);
      });
      expect(result.current).toBe(page);

      act(() => {
        pluginUIRegistry.unregisterPage('p1');
      });
      expect(result.current).toBeUndefined();
    });

    it('usePluginScriptStatus should track script status', () => {
      const { result } = renderHook(() => usePluginScriptStatus('p1'));
      
      expect(result.current).toBeUndefined();

      act(() => {
        pluginScriptTracker.setStatus('p1', 'loading');
      });
      expect(result.current).toBe('loading');

      act(() => {
        pluginScriptTracker.setStatus('p1', 'loaded');
      });
      expect(result.current).toBe('loaded');
    });
  });

  describe('Global exposure', () => {
    it('should be exposed on window', () => {
      expect(window.pluginUIRegistry).toBe(pluginUIRegistry);
    });
  });
});
