/**
 * Escape Probe: plugin UI.
 *
 * Runs inside the sandboxed plugin frame (`sandbox="allow-scripts"`, opaque
 * origin, the frame CSP, no permissions granted) and tries every way out it
 * can think of: the host DOM, top-level navigation, popups, the network, the
 * clipboard, Node globals and the plugin bridge beyond its permissions. Each
 * probe reports `blocked` or `open`; the e2e spec reads the lines from the
 * frame and expects every one to be `blocked`.
 *
 * Navigating this frame away is tried by the spec itself, from outside,
 * because even the refused attempt replaces this document with an error
 * page, and the report with it.
 */
(function () {
  var React = window.React;
  var useState = React.useState;
  var useEffect = React.useEffect;

  // A reserved TLD: never resolves, so a probe that got past the CSP would
  // still not reach anything. The CSP report tells both cases apart.
  var TARGET = 'https://escape-probe.invalid/';
  var PROBE_TIMEOUT_MS = 5000;

  var violations = [];
  document.addEventListener('securitypolicyviolation', function (event) {
    violations.push(event.violatedDirective);
  });

  function settle(promise) {
    return new Promise(function (resolve) {
      var timer = setTimeout(function () {
        resolve('timeout');
      }, PROBE_TIMEOUT_MS);
      promise.then(
        function (value) {
          clearTimeout(timer);
          resolve(value);
        },
        function () {
          clearTimeout(timer);
          resolve('blocked');
        }
      );
    });
  }

  var probes = {
    'parent-dom': function () {
      try {
        return window.parent.document ? 'open' : 'blocked';
      } catch {
        return 'blocked';
      }
    },
    'top-navigation': function () {
      try {
        window.top.location.href = TARGET;
        return 'open';
      } catch {
        return 'blocked';
      }
    },
    'window-open': function () {
      var opened = window.open(TARGET, '_blank');
      if (opened) {
        try {
          opened.close();
        } catch {
          // Nothing to clean up.
        }
      }
      return opened ? 'open' : 'blocked';
    },
    'node-globals': function () {
      return typeof require === 'undefined' && typeof process === 'undefined'
        ? 'blocked'
        : 'open';
    },
    'raw-ipc': function () {
      var bridge = window.electron || {};
      return typeof bridge.terminalCreate === 'undefined' &&
        typeof bridge.invoke === 'undefined' &&
        typeof bridge.ipcRenderer === 'undefined'
        ? 'blocked'
        : 'open';
    },
    fetch: function () {
      return settle(
        fetch(TARGET).then(function () {
          return 'open';
        })
      );
    },
    xhr: function () {
      return settle(
        new Promise(function (resolve, reject) {
          var request = new XMLHttpRequest();
          request.onerror = function () {
            reject(new Error('blocked'));
          };
          request.onload = function () {
            resolve('open');
          };
          request.open('GET', TARGET);
          request.send();
        })
      );
    },
    websocket: function () {
      return settle(
        new Promise(function (resolve, reject) {
          var socket = new WebSocket('wss://escape-probe.invalid/');
          socket.onerror = function () {
            reject(new Error('blocked'));
          };
          socket.onopen = function () {
            resolve('open');
          };
        })
      );
    },
    'sdk-permission': function () {
      // kubernetes.* needs the `kubernetes` permission, which is not declared.
      return settle(
        window.k8sPlugin.kubernetes.getPods('escape-probe').then(function () {
          return 'open';
        })
      );
    },
    'shim-permission': function () {
      // The legacy window.electron shim goes through the same gate.
      return settle(
        window.electron.getClusters().then(function (result) {
          return result && result.success ? 'open' : 'blocked';
        })
      );
    },
    'clipboard-read': function () {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        return 'blocked';
      }
      return settle(
        navigator.clipboard.readText().then(function () {
          return 'open';
        })
      );
    },
  };

  async function runProbes() {
    var lines = [];
    var names = Object.keys(probes);
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var outcome;
      try {
        outcome = await probes[name]();
      } catch {
        outcome = 'blocked';
      }
      lines.push(name + '=' + outcome);
    }
    lines.push('csp-violations=' + violations.join(','));
    lines.push('done=true');
    return lines;
  }

  function EscapeProbePage() {
    var state = useState(['done=false']);
    var lines = state[0];
    var setLines = state[1];

    useEffect(
      function () {
        var cancelled = false;
        runProbes().then(function (result) {
          if (cancelled) return;
          setLines(result);
        });
        return function () {
          cancelled = true;
        };
      },
      [setLines]
    );

    return React.createElement(
      'pre',
      { 'data-testid': 'escape-probe-results' },
      lines.join('\n')
    );
  }

  window.pluginUIRegistry.registerPage({ component: EscapeProbePage });
})();
