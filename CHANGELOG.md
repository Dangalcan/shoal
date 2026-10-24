# Changelog

All notable changes to Shoal are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/). Release steps are in
[docs/RELEASE.md](docs/RELEASE.md).

## [Unreleased]

### Added

- Local terminal sessions run in a pseudo-terminal (ConPTY on Windows, a
  pty on Linux) through node-pty: the shell prints its own prompt, edits
  the line and shows its colours, Ctrl+C reaches the running command as in
  any terminal, the shell follows the window size, and full-screen programs
  such as `vim`, `less`, `top` or `k9s` work. When the pseudo-terminal
  cannot start (no node-pty binary for the platform) the session falls
  back to pipes with the previous behaviour, and the log says why. Pod
  exec sessions still run on pipes.

### Changed

- The Linux build compiles node-pty (`npm run rebuild:node-pty`, part of
  `build:linux` and of the Linux release job; needs `make`, `g++` and
  `python3`). The Windows build uses the prebuilt binary that ships in the
  package.

## [Unreleased] - 0.9.0 public beta

First public release, for Windows and Linux. Installers are not code-signed
yet, so Windows SmartScreen shows a warning on first launch.

### Added

- An application menu, shown with Alt: zoom (Ctrl +, Ctrl −, Ctrl 0), full
  screen (F11), reload, and a Help menu with the user guide, a new GitHub
  issue, the logs folder and the About box. The window remembers its size,
  position and maximized state.
- Cluster management for local clusters created with kind or k3d, and any
  kubeconfig context.
- Dashboard with the active context summary, the state of Docker and Podman
  and the widgets of the enabled plugins; light and dark theme.
- Resource browser for the core resource kinds (workloads, networking,
  configuration, storage, RBAC, cluster objects) with namespace filter,
  sortable columns and a column picker, describe, YAML and recent logs,
  rollout restart, scaling and deletion. Settings hold the default
  namespace and the auto-refresh interval.
- Live log streaming. **Follow** in the log viewer streams new lines as the
  pod writes them (`kubectl logs -f`, starting from the last 200 lines), for
  the container chosen in the picker. The view scrolls with new lines while
  it is at the bottom and pauses when you scroll up to read, with a button to
  jump back to the latest line; the footer tells a snapshot from a live
  stream. The viewer keeps the last 5,000 lines. When the stream stops on its
  own (container stopped, pod deleted, kubectl error), a banner shows
  kubectl's reason and a **Reconnect** button. Streams stop when the viewer
  closes, the pod or container changes, Follow is turned off or the window
  reloads, and every kubectl process ends with Shoal.
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
- Electron 44.9 and Node 22 toolchain.
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

- A bundled plugin whose `activate()` never returns (a `kubectl` call
  against an unreachable cluster, say) is marked as errored after 30
  seconds, with the reason, instead of staying "loading", and Enable and
  Reload report it instead of hanging. The hook itself keeps running in the
  background.
- A pre-release build moves to the stable release as soon as it is
  published: the update check asks for the stable channel first and only
  falls back to pre-releases while no stable release exists.
- The log viewer drops a late answer from the pod opened before instead of
  showing its lines as the new pod's, starts blank when the same pod is
  opened on another cluster, and asks kubectl for the container shown in
  the picker. Init containers appear in the picker too.
- Screen readers get the names of the plugin settings fields, the shell
  picker of the pod terminal, the resource filter, the Compose manifest
  editor and the cluster name field; a plugin modal closes with Escape;
  marketplace cards open with Space as well as Enter.
- The window opens as soon as Shoal starts. It used to wait until every
  enabled plugin had finished activating, and Namespace Watcher's first
  `kubectl` call could hold it back for up to 30 seconds when the current
  context was unreachable. Plugins now activate after the window is up, one
  at a time with a 5-second budget each, and the plugin list and sidebar
  follow their state.
- A window in the dark theme no longer flashes light while it loads, it
  cannot be shrunk below 960 by 600 pixels, and a crashed window offers to
  reload instead of staying blank.
- Cluster details no longer alternate between a spinner and an error while
  the cluster is unreachable: the last data stays on screen while a refresh
  fails, and the error panel stays (with a "Retrying" hint) until a refresh
  succeeds.
- Namespace lists, logs, describe and YAML reads time out after 30 seconds
  like the resource tables, instead of waiting for kubectl's own network
  timeout.
- A missing kubectl is explained once by the notice on the page, without a
  second toast saying the same.
- The empty cluster list and the Dashboard say where Shoal looks for
  contexts (the kubeconfig) and how to point it elsewhere, and switching the
  active context says that it runs `kubectl config use-context`, so the
  terminal follows.
- Manifests show the database error instead of a generic message when the
  library cannot be read.
- The log viewer starts blank for the next pod instead of showing the
  previous pod's lines while the new ones load, offers a container picker
  for pods with several containers (sidecars) and a copy button.
- Sortable column headers, cluster cards, the Dashboard cluster list and the
  manifest drop zone work from the keyboard (Tab, Enter, Space) and announce
  their sort state.
- A page that throws no longer takes the sidebar with it: the error shows in
  the page area and the rest of the app stays usable.
- Native commands run from a Windows shell (`kubectl get pods`, `docker ps`)
  no longer print their output as a staircase: their bare line feeds return
  the cursor to the first column, like PowerShell's own `\r\n` does.
- Terminal output no longer splits a multibyte character (accented letters,
  box drawing) across two chunks.
- The main bundle no longer carries every Lucide icon for plugin resource
  actions; actions pick from a named set (see the plugin guide).
- Linux desktop entries carry a comment and search keywords, and
  `shoal --version` prints the version instead of opening a window.
- The bundled example plugins no longer offer "Uninstall" (they came back
  on the next launch); disable them instead. Uninstalling a plugin you
  installed now also removes its stored data.
- The "Update available" and "Update ready" toasts survive a renderer reload
  and no longer go missing when the start-up check finishes before the
  window is listening.
- The `.deb` package no longer runs the updater (it was never able to update
  itself); a manual check says to use the package manager instead.
- Local terminal: Ctrl+C now stops the running command (`ping`,
  `kubectl logs -f`) and leaves the shell usable. On Linux the interrupt
  only reached the shell; on Windows it stopped nothing at all (it looked
  the command up by process name and never found it). The terminal starts
  with the right line endings from the first prompt instead of being
  recreated when the shell list arrives; a shell that fails to start says so
  instead of hanging; open shells are closed when Shoal quits.
- The YAML and Describe views clear the previous resource's text when they
  open or fail to load; "Save to DB" could store the previous resource's
  YAML under the new name while the new one was still loading.
- The kubeconfig path placeholder in Settings matches the platform, and the
  terminal font stack covers Linux and macOS instead of falling back to the
  generic monospace font.
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

- The Compose conversion takes a token for the file chosen in the native
  dialog instead of a path from the renderer. `plugin-config.json`, which
  holds license keys and encrypted plugin secrets, is written owner-only.
  The `plugin-file:` error responses carry the frame policy too, and a
  plugin frame accepts its message port only from the host document that
  created it.
- Plugin frames keep their Content Security Policy whatever document they
  show: the `plugin-file:` protocol sends the policy as a header with every
  file, the main process blocks navigation of a plugin frame away from its
  host document, and the host hands the plugin its message port only once.
- Installed builds ignore `VITE_DEV_SERVER_URL`, which could have pointed
  the window, with its full IPC bridge, at any URL.
- Manifests handed to `kubectl apply` are written to private temporary files
  (owner-only, unguessable names, never over an existing file) instead of
  predictable, world-readable ones.
- Plugin resource events need the `kubernetes` permission, and a Secret
  reaches a plugin without its `data`. `helm repo add` from a plugin no
  longer repoints a repository name the user already has.
- Plugin host processes get a minimal environment (no `KUBECONFIG`, no cloud
  credentials), the `os` module is no longer exposed to plugin code, a
  plugin's `main` and `data` entries must stay inside its directory, and the
  signed file list refuses names that could forge the signed bytes.
- IPC calls are accepted from the main frame only, plugin exports are looked
  up as own properties (no `constructor` or prototype tricks) and lifecycle
  hooks cannot be invoked as actions from the UI.
- Local terminals start in the home directory instead of a shared folder
  under the system temp directory, and the main log shows the home folder
  as `~`.
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
- The `MARKETPLACE_PUBLIC_KEY` override of the plugin signing key is ignored
  in packaged builds, so an environment variable can no longer make an
  installed Shoal trust plugins signed with another key.

### Not in this release

- The plugin marketplace, paid plugins and licenses (planned for 1.0; hidden
  behind `MARKETPLACE_ENABLED`).
- macOS builds and code-signed installers.

### Known limitations

- Terminal sessions have no pseudo-terminal: the shell is not resized with
  the window and full-screen programs such as `vim` or `top` do not render
  correctly.
- Installed builds only run plugins signed with the Shoal key, which means
  the two bundled ones; third-party plugins load in development builds.
- The Windows portable build and the `.deb` package do not update
  themselves.
- On Ubuntu 24.04 the AppImage runs without Chromium's OS-level sandbox
  (AppArmor blocks it for unprivileged AppImages); the `.deb` installs an
  AppArmor profile and keeps it.
- The AppImage needs `libfuse2` (`libfuse2t64` on Ubuntu 24.04).

[Unreleased]: https://github.com/Dangalcan/shoal/compare/v0.9.0-rc.3...HEAD
