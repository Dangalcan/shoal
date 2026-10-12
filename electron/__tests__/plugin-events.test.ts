import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PluginEventBus,
  pluginEventBus,
} from '../services/plugins/plugin-events';
import type { BrowserWindow } from 'electron';

describe('PluginEventBus', () => {
  let bus: PluginEventBus;

  beforeEach(() => {
    bus = new PluginEventBus();
  });

  it('should set and get main window', () => {
    const mockWin = { id: 1 } as BrowserWindow;
    bus.setMainWindow(mockWin);
    expect(bus.getMainWindow()).toBe(mockWin);
  });

  it('should return null if main window is not set', () => {
    expect(bus.getMainWindow()).toBeNull();
  });

  it('should emit cluster:connected', () => {
    const spy = vi.fn();
    const cluster = { name: 'test-cluster' };
    bus.on('cluster:connected', spy);
    bus.emitClusterConnected(cluster);
    expect(spy).toHaveBeenCalledWith(cluster);
  });

  it('should emit cluster:disconnected', () => {
    const spy = vi.fn();
    const cluster = { name: 'test-cluster' };
    bus.on('cluster:disconnected', spy);
    bus.emitClusterDisconnected(cluster);
    expect(spy).toHaveBeenCalledWith(cluster);
  });

  it('should emit resource:created', () => {
    const spy = vi.fn();
    const resource = { name: 'test-resource' };
    bus.on('resource:created', spy);
    bus.emitResourceCreated(resource);
    expect(spy).toHaveBeenCalledWith(resource);
  });

  it('should emit resource:updated', () => {
    const spy = vi.fn();
    const resource = { name: 'test-resource' };
    bus.on('resource:updated', spy);
    bus.emitResourceUpdated(resource);
    expect(spy).toHaveBeenCalledWith(resource);
  });

  it('should emit resource:deleted', () => {
    const spy = vi.fn();
    const resource = { name: 'test-resource' };
    bus.on('resource:deleted', spy);
    bus.emitResourceDeleted(resource);
    expect(spy).toHaveBeenCalledWith(resource);
  });

  it('should emit plugin:activated', () => {
    const spy = vi.fn();
    bus.on('plugin:activated', spy);
    bus.emitPluginActivated('test-plugin');
    expect(spy).toHaveBeenCalledWith('test-plugin');
  });

  it('should emit plugin:deactivated', () => {
    const spy = vi.fn();
    bus.on('plugin:deactivated', spy);
    bus.emitPluginDeactivated('test-plugin');
    expect(spy).toHaveBeenCalledWith('test-plugin');
  });

  it('pushes plugin state changes to the main window', () => {
    const send = vi.fn();
    bus.setMainWindow({
      isDestroyed: () => false,
      webContents: { send },
    } as unknown as BrowserWindow);
    const spy = vi.fn();
    bus.on('plugin:state-changed', spy);
    const change = { pluginId: 'p', state: 'enabled' as const };
    bus.emitPluginStateChanged(change);
    expect(spy).toHaveBeenCalledWith(change);
    expect(send).toHaveBeenCalledWith('plugin-state-changed', change);
  });

  it('does not touch a destroyed or missing window', () => {
    const send = vi.fn();
    bus.setMainWindow({
      isDestroyed: () => true,
      webContents: { send },
    } as unknown as BrowserWindow);
    bus.emitPluginStateChanged({
      pluginId: 'p',
      state: 'error',
      error: 'boom',
    });
    expect(send).not.toHaveBeenCalled();
    expect(() =>
      new PluginEventBus().emitPluginStateChanged({
        pluginId: 'p',
        state: 'disabled',
      })
    ).not.toThrow();
  });

  it('exported pluginEventBus should be an instance of PluginEventBus', () => {
    expect(pluginEventBus).toBeInstanceOf(PluginEventBus);
  });
});
