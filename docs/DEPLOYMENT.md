# Deployment Guide 📦

This guide covers building and distributing Shoal for production environments.

## Prerequisites

- **Node.js**: v22.12+ (CI and local development use Node 22, see `.nvmrc`)
- **npm**: v9+
- A C++ toolchain only on Linux (`make`, `g++`, `python3`). Two native
  modules ship: better-sqlite3 has prebuilt binaries for every platform,
  node-pty only for Windows and macOS, so the Linux build compiles it
  (`npm run rebuild:node-pty`, part of `build:linux` and of the Linux
  release job). The project `.npmrc` turns dependency install scripts off,
  so `npm ci` compiles nothing (npm/cli#9837).
- No platform-specific tools: electron-builder downloads what it needs
  (NSIS on Windows, its packaging tools for the AppImage and the `.deb` on
  Linux). Each platform is built on its own OS; the CI runners are
  `windows-latest` and `ubuntu-24.04`.
- macOS is not built in 0.9. It arrives with 1.0 and needs an Apple
  Developer account for signing and notarization.

---

## Building the Application

### 1. Install Dependencies

```bash
npm install
```

### 2. Build for Production

This command compiles both the React frontend and the Electron main process, then bundles them into an installer.

```bash
npm run build
```

**What this does:**

- Runs `vite build` (frontend)
- Runs `tsc` on the `electron/` directory
- Executes `electron-builder`, whose `beforePack` hook
  (`scripts/third-party-notices.js`) writes `build/THIRD_PARTY_NOTICES.txt`;
  it ships in `resources` with `LICENSE.txt`, `COPYING.txt` and
  `COPYRIGHT.txt`

### 3. Platform-Specific Commands

Use the dedicated per-platform scripts:

```bash
# Windows (produces .exe NSIS installer and portable .exe)
npm run build:win

# Linux (produces .AppImage and .deb)
npm run build:linux
```

> **Note:** There is no macOS build in 0.9. `electron-builder --mac` is not configured and needs signing set up first (1.0).

---

## Code Signing

The 0.9 beta installers are **not** code-signed: Windows SmartScreen shows
"Windows protected your PC" on first launch (More info → Run anyway). Signing
is planned for 1.0 (see the roadmap in the README): a SignPath Foundation
certificate or an OV/EV certificate on Windows, an Apple Developer
certificate with notarization on macOS. Once a Windows certificate exists:

1. Set environment variables in the release workflow:
   - `CSC_LINK`: Path to (or base64 of) the `.pfx` certificate file.
   - `CSC_KEY_PASSWORD`: Password for the certificate.
2. Build the app; electron-builder signs the installer and the portable
   executable.

---

## Distribution

Official releases are generated in the `release/` directory.

### Output Formats

- **Windows**: `.exe` (NSIS installer) and portable `.exe`
- **Linux**: `Shoal-x86_64.AppImage` (no version in the name, see Auto-Update),
  `shoal_<version>_amd64.deb`
- **macOS**: not built in 0.9

### Auto-Update

Shoal supports auto-updates via GitHub Releases. Configuration in the `build.publish` section of `package.json`:

```yaml
publish:
  provider: github
  owner: Dangalcan
  repo: shoal
```

The installed app checks for updates on startup (NSIS installer and AppImage
only; the Windows portable build and the `.deb` never self-update). The check
asks the stable channel first (`/releases/latest`); only when no stable
release exists yet and the installed version is a pre-release does it check
again accepting pre-releases. A release candidate therefore updates to the
next candidate until `0.9.0` is published and to `0.9.0` after that; stable
versions never receive pre-releases.

The AppImage is published as `Shoal-x86_64.AppImage`
(`build.appImage.artifactName` in `package.json`; electron-builder's default
would be `Shoal-<version>.AppImage`). electron-updater's `AppImageUpdater`
keeps the running file's name only when it contains no version number
(`\d+\.\d+\.\d+`), otherwise it deletes the file and writes
`Shoal-<new version>.AppImage` beside it; with the unversioned name every
update is an in-place replacement and desktop entries, launchers and scripts
keep working (#31). One-time effect: a user still running a versioned file
from 0.9.1 or earlier gets `Shoal-x86_64.AppImage` in the same folder at the
first update. The `.deb` keeps the version in its file name, as package
managers expect, and the `*.AppImage` globs in `build.yml` and
`docs/RELEASE.md` match either name.

### Cutting a release

Releases are built and uploaded by `.github/workflows/build.yml` when a `v*`
tag is pushed. The full process, including how to publish the draft and how
to roll back, is in [RELEASE.md](RELEASE.md).

### Package managers

Manifests for winget (`Dangalcan.Shoal`), Scoop (`shoal`, in our own bucket)
and the AUR (`shoal-bin`, repackaging the `.deb`) live in
[`packaging/`](../packaging/README.md), written for the first stable release
with the hashes left to fill in on release day. That README has the steps per
ecosystem: hashes, validation and submission (pull request to
microsoft/winget-pkgs, push to the Scoop bucket, push to the AUR).

---

## Troubleshooting

### npm tries to run node-gyp

`npm ci` or `npm install` should never compile anything. If you see
`node-gyp rebuild` errors, check that `.npmrc` (with `ignore-scripts=true`) is
in the repository root and that you run npm from there, then reinstall:

```bash
npm ci
```

### AppImage does not launch on Linux

```bash
chmod +x Shoal-x86_64.AppImage
./Shoal-x86_64.AppImage
```

- Ubuntu 22.04 and later do not install `libfuse2`, which AppImages need:
  `sudo apt install libfuse2` (`libfuse2t64` on Ubuntu 24.04). Without FUSE
  the AppImage can still run with `APPIMAGE_EXTRACT_AND_RUN=1`, as the CI
  smoke job does.
- The `.deb` lists its dependencies in `build.deb.depends` (package.json):
  electron-builder's default list plus `libasound2 (>= 1.0.17)` and
  `libgbm1`, which Electron links and minimal systems lack (2026-10-31:
  `libasound.so.2` missing on WSL, both missing on a bare `ubuntu:24.04`
  container; the GitHub runner image has them, so the smoke job cannot
  notice). Setting `depends` replaces the default list, so keep the defaults
  when editing it. Keep the version too: on Ubuntu 24.04 `libasound2` is
  only a virtual name, provided by `libasound2t64` (versioned) and by
  `liboss4-salsa-asound2` (an OSS compatibility shim, unversioned), and
  `apt-get -s install` of a package that asks for the bare name picks the
  shim; the versioned dependency resolves to the real library. The AppImage
  bundles no system libraries, so it still needs both from the system:
  `sudo apt install libasound2t64 libgbm1` (`libasound2` before 24.04).
  The Build/Release workflow installs every `.deb` on a bare `ubuntu:24.04`
  container and fails on an unresolved library (`scripts/check-deb.sh`, job
  `deb`).
- Ubuntu 24.04 restricts unprivileged user namespaces through AppArmor
  (`kernel.apparmor_restrict_unprivileged_userns=1`), which Chromium's
  sandbox needs. The AppImage launcher generated by electron-builder detects
  this (`unshare -Ur true` fails) and starts Shoal with `--no-sandbox`, so
  the app runs without Chromium's OS-level sandbox there (checked on a
  clean ubuntu-24.04 runner, 2026-10-12). The `.deb` installs an AppArmor
  profile (`/etc/apparmor.d/shoal`) that keeps the sandbox; recommend it on
  Ubuntu 24.04.
