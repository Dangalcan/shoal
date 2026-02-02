/**
 * Plugin Event Bus
 *
 * Central event system for plugin communication and app events.
 */

import { EventEmitter } from 'events';

export class PluginEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Allow many plugins to listen
  }

  /**
   * Emit cluster connected event
   */
  emitClusterConnected(cluster: any): void {
    this.emit('cluster:connected', cluster);
  }

  /**
   * Emit cluster disconnected event
   */
  emitClusterDisconnected(cluster: any): void {
    this.emit('cluster:disconnected', cluster);
  }

  /**
   * Emit resource created event
   */
  emitResourceCreated(resource: any): void {
    this.emit('resource:created', resource);
  }

  /**
   * Emit resource updated event
   */
  emitResourceUpdated(resource: any): void {
    this.emit('resource:updated', resource);
  }

  /**
   * Emit resource deleted event
   */
  emitResourceDeleted(resource: any): void {
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
}

export const pluginEventBus = new PluginEventBus();
