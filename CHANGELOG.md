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

### Changed

- Renamed from Kubernetes Desktop to Shoal (Linux Foundation trademark
  guidelines), with a new app icon.
- Electron 44 and Node 22 toolchain.
- The app version shown in the sidebar now always comes from `package.json`.

### Not in this release

- The plugin marketplace, paid plugins and licenses (planned for 1.0; hidden
  behind `MARKETPLACE_ENABLED`).
- macOS builds and code-signed installers.
