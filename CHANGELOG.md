# Changelog

All notable changes to Shoal are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/). Release steps are in
[docs/RELEASE.md](docs/RELEASE.md).

## [Unreleased] - 0.9.0 public beta

First public release, for Windows and Linux. Installers are not code-signed
yet, so Windows SmartScreen shows a warning on first launch.

### Added

- Cluster management for local clusters created with kind or k3d, and any
  kubeconfig context.
- Dashboard with the active context summary, the state of Docker and Podman
  and the widgets of the enabled plugins; light and dark theme.
- Resource browser for the core resource kinds (workloads, networking,
  configuration, storage, RBAC, cluster objects) with namespace filter,
  sortable columns and a column picker, describe, YAML and recent logs,
  rollout restart, scaling and deletion. Settings hold the default
  namespace and the auto-refresh interval.
- Manifest library with folders, templates, file import and one-click apply.
- Docker Compose to Kubernetes migration through kompose.
- Local terminal and pod exec sessions, and port-forward management.
- Sandboxed plugin system with two signed example plugins, Namespace Watcher
  and Resource Monitor, enabled on first run.
- Auto-update from GitHub Releases for the Windows installer and the AppImage.
- Guidance when kubectl, kind, k3d or Docker is missing, with install links
  and a re-check button. On Windows the re-check also picks up tools
  installed while Shoal was running (it re-reads the registry `PATH`).
- A custom kubeconfig path set in Settings is remembered across restarts.
- Local error log for the main process and the UI, and an About & Support
  card in Settings with the version, an update check, the logs folder and a
  prefilled GitHub issue. Nothing is sent anywhere.
- Installers ship `LICENSE.txt`, `COPYRIGHT.txt` and `THIRD_PARTY_NOTICES.txt`
  with the license texts of every bundled open source package.

### Changed

- Renamed from Kubernetes Desktop to Shoal (Linux Foundation trademark
  guidelines), with a new app icon.
- Electron 44 and Node 22 toolchain.
- The app version shown in the sidebar now always comes from `package.json`.
- Cluster cards show the real provider (kind or k3d, from the context name)
  and no longer label every context as running.
- Dependency updates before the beta. React 19.3, lucide-react 1.x (two
  icons are redrawn), js-yaml 5 (still reads Compose files with the YAML 1.1
  rules, so merge keys keep working) and semver 7.8, plus build and test
  tooling (Vitest 5, Playwright 1.64, Tailwind CSS 4.3, Prettier 3.9).
  The GitHub Actions workflows use the Node 24 releases of their actions.
- The installers no longer carry a second, unused copy of the renderer
  libraries (React, React Router, lucide, sonner, xterm, clsx,
  tailwind-merge): Vite already bundles them, so they are build-time
  dependencies now. The packed application code (`app.asar`) shrinks from
  50 MB to 8 MB; the compressed installers lose about 2 MB. The third-party
  notices are unchanged.

### Fixed

- Local terminal: on Linux, Ctrl+C now reaches the running command (`ping`,
  `kubectl logs -f`) instead of only the shell; the terminal starts with the
  right line endings from the first prompt instead of being recreated when
  the shell list arrives; a shell that fails to start says so instead of
  hanging; open shells are closed when Shoal quits.
- Toasts no longer appear twice on the Clusters and cluster details pages.
- Creating a cluster that fails showed a green "created" toast next to the
  red one; it now shows one toast with the result.
- Contexts whose name contains a slash (EKS, OpenShift) opened a blank page
  from the cluster list; unknown routes now land on the dashboard.
- "Check for updates" no longer says "this build cannot update itself" when
  the check merely failed (offline) or ran from a development build.
- A missing kubectl is reported as "not installed or not on the PATH"
  instead of "spawn kubectl ENOENT", failed commands show the tool's own
  message rather than the whole command line, and a failing auto-refresh
  reports once instead of stacking a toast every interval.
- The dashboard shows a container engine that is not installed as neutral,
  not as an error; only an installed engine that is stopped is red.
- A failure while the app starts shows an error dialog and quits instead of
  leaving an invisible process behind.
- "Load Unpacked Plugin" checks the signature before copying a plugin, and an
  unsigned plugin is explained as unsigned instead of "may be tampered with".
- The bundled example plugins no longer show an "is now active" toast on
  every launch, Namespace Watcher warns once (not every 30 seconds) when
  the cluster is unreachable, and its bundled data file is now actually
  read: plugin data files are stored as `data/<name>` (the leading `data/`
  folder is collapsed). Both examples use the sandbox API
  (`window.k8sPlugin`) the plugin guide documents.
- Manifest cards showed the save date in UTC (one day off late in the
  evening in Europe). SQLite timestamps are now read as UTC.
- Plugin pages, widgets and modals render in installed builds. Sandboxed
  plugin frames could not load `file:` resources, so they stayed blank.
- The manifest editor no longer steals focus from the other fields.
- Switching context no longer resets the Default Namespace setting, and the
  "default" option in Settings now really selects the `default` namespace
  (it used to fall back to all namespaces).
- Setting a kubeconfig path refreshes the cluster list and current context
  immediately.
- Deleting a context that is not a kind or k3d cluster says "Remove
  Context" and explains that only the kubeconfig entry goes; the cluster is
  not touched.
- kubectl list reads time out after 30 seconds and a read that is still
  running is shared by every poller instead of started again each interval,
  so a stuck credential prompt no longer piles up kubectl processes.
- `context.ui.openModal` from main-process plugin code opens the plugin's
  modal; the event was sent but nothing in the UI listened.

### Security

- Plugin signatures cover every file of the plugin, code included, not only
  `plugin.json`. A signed manifest can no longer vouch for swapped code, and an
  imported plugin can no longer take the id of a plugin bundled with Shoal.
- Electron fuses: the executable no longer runs as plain Node.js
  (`ELECTRON_RUN_AS_NODE`), ignores `NODE_OPTIONS`, and only loads its
  integrity-checked `app.asar`.
- Web permission requests are denied except clipboard writes.
- Plugins cannot pass a kubectl flag as the resource type of a watch.
- The `plugin-file:` protocol only serves files inside the plugin folders and
  the app bundle.
- Stricter Content Security Policy for the app and the plugin frames, a single
  app instance, external links opened in the browser and navigation away from
  the app blocked.
- IPC debug logs redact license keys, secret settings and Helm values.
- Every plugin IPC handler validates the plugin id before it reaches the
  file system, uninstalling can no longer target the plugins folder itself,
  and manifest IPC handlers check ids and sizes like the folder handlers.
- Plugin process isolation can only be turned off outside packaged builds.

### Not in this release

- The plugin marketplace, paid plugins and licenses (planned for 1.0; hidden
  behind `MARKETPLACE_ENABLED`).
- macOS builds and code-signed installers.

### Known limitations

- Terminal sessions have no pseudo-terminal: the shell is not resized with
  the window and full-screen programs such as `vim` or `top` do not render
  correctly.
- Logs are fetched on demand (the last 200 lines), not streamed.
- Installed builds only run plugins signed with the Shoal key, which means
  the two bundled ones; third-party plugins load in development builds.
- The Windows portable build and the `.deb` package do not update
  themselves.
- On Ubuntu 24.04 the AppImage runs without Chromium's OS-level sandbox
  (AppArmor blocks it for unprivileged AppImages); the `.deb` installs an
  AppArmor profile and keeps it.
- The AppImage needs `libfuse2` (`libfuse2t64` on Ubuntu 24.04).

[Unreleased]: https://github.com/Dangalcan/shoal/compare/v0.9.0-rc.2...HEAD
