/**
 * Plugin Event Bus
 *
 * Central event system for plugin communication and app events.
 */

import { EventEmitter } from 'events';
import type { BrowserWindow } from 'electron';
import type { PluginStateChange } from '../../types/plugin-types';

export class PluginEventBus extends EventEmitter {
  /** Reference to the main BrowserWindow, set by main.ts after window creation. */
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    super();
    this.setMaxListeners(100); // Allow many plugins to listen
  }

  /** Called once by main.ts after the window is ready. */
  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win;
  }

  /** Returns the main window, or null if not yet created. */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /**
   * Emit cluster connected event
   */
  emitClusterConnected(cluster: unknown): void {
    this.emit('cluster:connected', cluster);
  }

  /**
   * Emit cluster disconnected event
   */
  emitClusterDisconnected(cluster: unknown): void {
    this.emit('cluster:disconnected', cluster);
  }

  /**
   * Emit resource created event
   */
  emitResourceCreated(resource: unknown): void {
    this.emit('resource:created', resource);
  }

  /**
   * Emit resource updated event
   */
  emitResourceUpdated(resource: unknown): void {
    this.emit('resource:updated', resource);
  }

  /**
   * Emit resource deleted event
   */
  emitResourceDeleted(resource: unknown): void {
    this.emit('resource:deleted', resource);
  }

  /**
   * Emit plugin activated event
   */
  emitPluginActivated(pluginId: string): void {
    this.emit('plugin:activated', pluginId);
  }

  /**
   * Emit plugin deactivated event
   */
  emitPluginDeactivated(pluginId: string): void {
    this.emit('plugin:deactivated', pluginId);
  }

  /**
   * Emit a plugin state change and push it to the renderer, so the plugin
   * list and the sidebar follow activations that finish after the window
   * opened, as well as reloads and failures.
   */
  emitPluginStateChanged(change: PluginStateChange): void {
    this.emit('plugin:state-changed', change);
    const win = this.mainWindow;
    if (win && !win.isDestroyed()) {
      win.webContents.send('plugin-state-changed', change);
    }
  }
}

export const pluginEventBus = new PluginEventBus();
