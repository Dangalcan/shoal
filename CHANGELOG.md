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
- Resource browser with namespace filter, YAML and logs, rollout restart,
  scaling and deletion.
- Manifest library with folders, templates, file import and one-click apply.
- Docker Compose to Kubernetes migration through kompose.
- Local terminal and pod exec sessions, and port-forward management.
- Sandboxed plugin system with two signed example plugins, Namespace Watcher
  and Resource Monitor, enabled on first run.
- Auto-update from GitHub Releases for the Windows installer and the AppImage.
- Guidance when kubectl, kind, k3d or Docker is missing, with install links
  and a re-check button.
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

### Fixed

- Plugin pages, widgets and modals render in installed builds. Sandboxed
  plugin frames could not load `file:` resources, so they stayed blank.
- The manifest editor no longer steals focus from the other fields.

### Security

- The `plugin-file:` protocol only serves files inside the plugin folders and
  the app bundle.
- Stricter Content Security Policy for the app and the plugin frames, a single
  app instance, external links opened in the browser and navigation away from
  the app blocked.
- IPC debug logs redact license keys, secret settings and Helm values.
- Plugin process isolation can only be turned off outside packaged builds.

### Not in this release

- The plugin marketplace, paid plugins and licenses (planned for 1.0; hidden
  behind `MARKETPLACE_ENABLED`).
- macOS builds and code-signed installers.
