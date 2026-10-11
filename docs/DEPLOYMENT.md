# Deployment Guide 📦

This guide covers building and distributing Shoal for production environments.

## Prerequisites

- **Node.js**: v22.12+ (CI and local development use Node 22, see `.nvmrc`)
- **npm**: v9+
- Platform-specific build tools (see below)

### Windows

- **Windows 10/11 SDK**
- **Visual Studio Build Tools** (including C++ desktop development)

### macOS

- **Xcode Command Line Tools**
- **Apple Developer Account** (required for code signing and notarization)

### Linux

- **Standard build tools** (`build-essential` on Ubuntu/Debian)
- `fakeroot` (for the .deb package)

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
  it ships in `resources` with `LICENSE.txt` and `COPYRIGHT.txt`

### 3. Platform-Specific Commands

Use the dedicated per-platform scripts:

```bash
# Windows (produces .exe NSIS installer and portable .exe)
npm run build:win

# Linux (produces .AppImage and .deb)
npm run build:linux
```

> **Note:** There is no dedicated macOS build script. macOS builds require running `electron-builder --mac` manually with appropriate signing environment variables set.

---

## Code Signing

Signing your application is critical to avoid "Unknown Publisher" warnings and to ensure macOS Gatekeeper allows the app to run.

### Windows

1. Obtain a **Code Signing Certificate** (e.g., from Sectigo or DigiCert).
2. Set environment variables:
   - `CSC_LINK`: Path to your `.pfx` certificate file.
   - `CSC_KEY_PASSWORD`: Password for the certificate.
3. Build the app.

### macOS

1. Ensure you have an **Apple Developer Certificate** in your Keychain.
2. Set environment variables:
   - `APPLE_ID`: Your Apple ID email.
   - `APPLE_ID_PASSWORD`: An app-specific password.
   - `CSC_NAME`: The name of your certificate in Keychain (e.g., "Developer ID Application: Your Name").
3. Build the app. `electron-builder` will handle signing and notarization automatically.

---

## Distribution

Official releases are generated in the `release/` directory.

### Output Formats

- **Windows**: `.exe` (NSIS installer) and portable `.exe`
- **Linux**: `.AppImage`, `.deb`
- **macOS**: not configured yet (requires a manual `electron-builder --mac` run with signing set up)

### Auto-Update

Shoal supports auto-updates via GitHub Releases. Configuration in `package.json` or `electron-builder.yml`:

```yaml
publish:
  provider: github
  owner: Dangalcan
  repo: shoal
```

The installed app checks for updates on startup (NSIS installer and AppImage
only; the Windows portable build never self-updates). Pre-release versions
such as `0.9.0-rc.1` also receive pre-releases, stable versions only stable
releases.

### Cutting a release

Releases are built and uploaded by `.github/workflows/build.yml` when a `v*`
tag is pushed. The full process, including how to publish the draft and how
to roll back, is in [RELEASE.md](RELEASE.md).

---

## Troubleshooting

### Build fails on Windows

If you see errors related to `node-gyp` or native modules:

```bash
npm install --global windows-build-tools
```

### macOS Notarization fails

- Ensure you are using an **app-specific password**, not your main Apple ID password.
- Verify that your `CSC_NAME` matches exactly what is in Keychain Access.

### AppImage permissions on Linux

If the AppImage doesn't launch:

```bash
chmod +x Shoal.AppImage
./Shoal.AppImage
```

Note: Some modern Linux distros (like Ubuntu 23.04+) may require `libfuse2` to run AppImages: `sudo apt install libfuse2`.
