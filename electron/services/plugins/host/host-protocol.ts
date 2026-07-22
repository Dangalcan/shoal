/**
 * Plugin Host Protocol
 *
 * Message shapes exchanged between the main process and a plugin utility
 * process over `MessagePort`-style channels. All payloads must be
 * structured-cloneable; functions are encoded as callback descriptors
 * (`CallbackRef`) and invoked back across the channel by id.
 */

/** Marks that argument `index` of a context call is a function on the host side. */
export interface CallbackRef {
  index: number;
  cbId: number;
}

/** Messages sent from the main process to the plugin host process. */
export type MainToHostMessage =
  | {
      type: 'init';
      pluginId: string;
      pluginPath: string;
      /** Absolute path to the plugin entry file (index.js). */
      mainFile: string;
      permissions: string[];
    }
  | {
      /** Call an exported plugin function (lifecycle hook or action). */
      type: 'invoke';
      id: number;
      name: string;
      /** When true the host passes its proxied PluginContext as the argument. */
      withContext: boolean;
      args: unknown[];
    }
  | {
      /** Deliver an event to a callback previously registered by the host. */
      type: 'callback';
      cbId: number;
      args: unknown[];
    }
  | {
      /** Response to a `context-call`. */
      type: 'context-result';
      id: number;
      ok: boolean;
      result?: unknown;
      error?: string;
    }
  | { type: 'shutdown' };

/** Messages sent from the plugin host process to the main process. */
export type HostToMainMessage =
  | {
      /** Plugin code executed; lists the module's export names. */
      type: 'loaded';
      exports: string[];
    }
  | { type: 'load-error'; error: string }
  | {
      type: 'invoke-result';
      id: number;
      ok: boolean;
      result?: unknown;
      error?: string;
    }
  | {
      /**
       * Call a PluginContext method that needs a response
       * (e.g. `kubernetes.getResources`, `storage.get`) or that registers
       * callbacks (`kubernetes.watchResources`, `events.onBroadcast`, ...).
       */
      type: 'context-call';
      id: number;
      /** Dot path on the context, e.g. "kubernetes.getResources". */
      path: string;
      args: unknown[];
      callbacks?: CallbackRef[];
    }
  | {
      /** Fire-and-forget context method (ui.*, logger.*, events.broadcast). */
      type: 'context-notify';
      path: string;
      args: unknown[];
    }
  | {
      /** Tear down a callback registration (watch cleanup, offBroadcast). */
      type: 'unsubscribe';
      cbId: number;
    };

/** Minimal port interface shared by both sides (adapts MessagePortMain). */
export interface HostMessagePort<TSend, TReceive> {
  postMessage(message: TSend): void;
  onMessage(listener: (message: TReceive) => void): void;
}
