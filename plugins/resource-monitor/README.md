# Resource Monitor

Bundled example plugin. It shows the pods of the current context with their
phase, restarts and live CPU and memory usage (when the cluster has
metrics-server), and raises a notification when a pod restarts too often or
uses too much CPU.

What it shows:

- `index.js` (main process): a periodic scan with `context.kubernetes`,
  de-duplicated notifications with `context.ui.notifyOnce`, a sidebar entry,
  state kept in plugin storage.
- `plugin.json`: a dashboard widget declared under `extensions.widgets`.
- `renderer.js` (sandboxed iframe): the page and the widget component, which
  talk to the host only through `window.k8sPlugin`
  (`kubernetes.getCurrentContext`, `kubernetes.getPods`,
  `kubernetes.getPodMetrics`).

It depends on Namespace Watcher (`dependencies` in `plugin.json`), which Shoal
enables with it.

Every file in this folder is covered by `plugin.json.sig`. After any change,
re-sign with `node scripts/sign-plugin.js plugins/resource-monitor` (needs the
Shoal private key); development builds load it unsigned with
`ALLOW_UNSIGNED_PLUGINS=true`. See `docs/PLUGINS_GUIDE.md`.
