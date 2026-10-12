# Namespace Watcher

Bundled example plugin. It lists the namespaces of the current context with
their status, age, labels and resource counts, and warns when the namespace
count passes a threshold.

What it shows:

- `index.js` (main process): lifecycle hooks, event subscriptions, a sidebar
  entry, a bundled data file (`data/default-config.json`, read from plugin
  storage as `data/default-config`) and settings declared in `plugin.json`
  (read from storage under `settings`).
- `renderer.js` (sandboxed iframe): a page built with the injected `React`,
  `K8sUI` and `LucideIcons` globals that talks to the host only through
  `window.k8sPlugin` (`kubernetes.getCurrentContext`, `kubernetes.getResources`,
  `settings.get`).

Every file in this folder is covered by `plugin.json.sig`. After any change,
re-sign with `node scripts/sign-plugin.js plugins/namespace-watcher` (needs the
Shoal private key); development builds load it unsigned with
`ALLOW_UNSIGNED_PLUGINS=true`. See `docs/PLUGINS_GUIDE.md`.
