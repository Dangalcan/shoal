/*
 * Plugin iframe bootstrap (runs INSIDE the sandboxed plugin iframe).
 *
 * Vanilla JS on purpose: this file ships as a static asset and must run with
 * no bundler and no imports. It is the iframe-side twin of
 * src/features/plugins/sandbox/plugin-sdk.ts and MUST stay protocol-compatible
 * with src/features/plugins/sandbox/protocol.ts. Keep the message shapes in
 * sync if the protocol changes.
 *
 * Responsibilities:
 *   1. Receive the MessagePort + plugin URLs from the host (PLUGIN_PORT_INIT).
 *   2. Expose window.k8sPlugin (promise-based, permission-gated by the host).
 *   3. Load the plugin's stylesheets and renderer entry into this document.
 *   4. Signal readiness.
 */
(function () {
  'use strict';

  var PLUGIN_PORT_INIT = 'k8s-plugin-port-init';

  window.addEventListener('message', function onInit(event) {
    if (!event.data || event.data.type !== PLUGIN_PORT_INIT) return;
    var port = event.ports && event.ports[0];
    if (!port) return;
    window.removeEventListener('message', onInit);

    var sdk = createSdk(port);
    window.k8sPlugin = sdk;

    loadStyles(event.data.styleUrls || []);
    loadEntry(event.data.entryUrl, sdk);
  });

  function createSdk(port) {
    var nextId = 1;
    var pending = {};
    var eventHandlers = {};

    port.onmessage = function (ev) {
      var msg = ev.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.kind === 'rpc-response') {
        var entry = pending[msg.id];
        if (!entry) return;
        delete pending[msg.id];
        if (msg.ok) entry.resolve(msg.result);
        else entry.reject(new Error(msg.error));
        return;
      }
      if (msg.kind === 'event') {
        var handlers = eventHandlers[msg.name];
        if (handlers) {
          handlers.slice().forEach(function (h) {
            h(msg.payload);
          });
        }
      }
    };
    if (port.start) port.start();

    function call(method) {
      var args = Array.prototype.slice.call(arguments, 1);
      var id = nextId++;
      return new Promise(function (resolve, reject) {
        pending[id] = { resolve: resolve, reject: reject };
        port.postMessage({
          kind: 'rpc-request',
          id: id,
          method: method,
          args: args,
        });
      });
    }

    function signal(msg) {
      port.postMessage(msg);
    }

    return {
      kubernetes: {
        getResources: function (a) {
          return call('kubernetes.getResources', a);
        },
        getPods: function (c) {
          return call('kubernetes.getPods', c);
        },
        getNamespaces: function (c) {
          return call('kubernetes.getNamespaces', c);
        },
        getLogs: function (a) {
          return call('kubernetes.getLogs', a);
        },
        describeResource: function (a) {
          return call('kubernetes.describeResource', a);
        },
        getResourceYaml: function (a) {
          return call('kubernetes.getResourceYaml', a);
        },
        deleteResource: function (a) {
          return call('kubernetes.deleteResource', a);
        },
        getCurrentContext: function () {
          return call('kubernetes.getCurrentContext');
        },
        getClusters: function () {
          return call('kubernetes.getClusters');
        },
      },
      manifests: {
        apply: function (id) {
          return call('manifests.apply', id);
        },
        save: function (m) {
          return call('manifests.save', m);
        },
      },
      settings: {
        get: function () {
          return call('settings.get');
        },
        set: function (s) {
          return call('settings.set', s);
        },
      },
      ui: {
        openExternal: function (url) {
          return call('ui.openExternal', url);
        },
        showNotification: function (message, type) {
          return call('ui.showNotification', message, type || 'info');
        },
        setHeight: function (h) {
          signal({ kind: 'ui', type: 'resize', height: h });
        },
        setTitle: function (t) {
          signal({ kind: 'ui', type: 'title', title: t });
        },
      },
      events: {
        on: function (name, handler) {
          if (!eventHandlers[name]) eventHandlers[name] = [];
          eventHandlers[name].push(handler);
          return function () {
            eventHandlers[name] = (eventHandlers[name] || []).filter(
              function (h) {
                return h !== handler;
              }
            );
          };
        },
      },
      ready: function () {
        signal({ kind: 'ui', type: 'ready' });
      },
    };
  }

  function loadStyles(urls) {
    urls.forEach(function (href) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    });
  }

  function loadEntry(entryUrl, sdk) {
    if (!entryUrl) return;
    var script = document.createElement('script');
    script.src = entryUrl;
    script.onload = function () {
      // Auto-observe content height so the host can size the iframe.
      try {
        var report = function () {
          sdk.ui.setHeight(document.documentElement.scrollHeight);
        };
        report();
        if (window.ResizeObserver) {
          new ResizeObserver(report).observe(document.documentElement);
        }
      } catch (e) {
        /* non-fatal */
      }
    };
    script.onerror = function () {
      sdk.ui.showNotification('Failed to load plugin UI bundle', 'error');
    };
    document.body.appendChild(script);
  }
})();
