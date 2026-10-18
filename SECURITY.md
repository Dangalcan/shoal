# Security Policy

## Supported Versions

The following versions of Shoal are currently supported with security updates:

| Version                     | Supported                                 |
| --------------------------- | ----------------------------------------- |
| 0.9.x (latest release)      | :white_check_mark:                        |
| 0.9.0 pre-releases (`rc.*`) | Until 0.9.0 ships; unsupported after that |
| Older releases              | :x:                                       |

## Installers

The 0.9 installers are **not code-signed**, so Windows SmartScreen warns on first start. Download them only from this repository's [Releases](https://github.com/Dangalcan/shoal/releases) page. To check a download, compare its SHA-512 with the one electron-builder publishes next to it: `latest.yml` lists the Windows installer, `latest-linux.yml` the AppImage. Both store the hash base64-encoded, so compute it the same way:

```bash
openssl dgst -sha512 -binary Shoal-<version>.AppImage | base64 -w0
```

```powershell
[Convert]::ToBase64String([Security.Cryptography.SHA512]::Create().ComputeHash([IO.File]::ReadAllBytes((Resolve-Path .\Shoal-Setup-<version>.exe))))
```

Auto-update checks that same hash before installing. Code signing is planned for 1.0.

## Reporting a Vulnerability

We take the security of Shoal seriously. If you believe you have found a security vulnerability, please report it to us responsibly.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them privately through [GitHub private vulnerability reporting](https://github.com/Dangalcan/shoal/security/advisories/new). If that form is not available to you, email <security@dangalcan.com>.

### What to include in your report

Please include the following information in your report:

- **Type of issue** (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- **Full paths of source file(s)** related to the manifestation of the issue
- **Location of the affected source code** (tag/branch/commit or direct URL)
- **Any special configuration required** to reproduce the issue
- **Step-by-step instructions** to reproduce the issue
- **Proof-of-concept or exploit code** (if possible)
- **Impact of the issue**, including how an attacker might exploit it

### Our Process

1. **Acknowledgement:** Shoal is maintained by one person, so expect an acknowledgement within a few days. If you hear nothing after a week, please follow up on the advisory thread to make sure the report arrived.
2. **Investigation:** We will investigate the issue and may ask for additional information.
3. **Resolution:** If a vulnerability is confirmed, we will work on a fix.
4. **Public Disclosure:** Once a fix is available and tested, we will release a new version. We will coordinate the public disclosure with you to give credit where it's due.

## Security Best Practices

### For Users

- **Keep Shoal up to date:** Always use the latest version to ensure you have the latest security patches.
- **Only install plugins from trusted sources:** Plugins have significant access to your system and clusters. This applies from 1.0: installed builds of the 0.9 beta only run the two bundled plugins.
- **Review plugin permissions:** Check what a plugin asks for before installing it (from 1.0, when third-party plugins can be installed).
- **Kubeconfig Safety:** Your `.kube/config` file contains sensitive credentials. Ensure it's stored securely and not shared.

### For Plugin Developers

- **Follow the Security Guidelines:** Read the [Plugin Development Guide](docs/PLUGINS_GUIDE.md) for security best practices.
- **Principle of Least Privilege:** Only request the permissions your plugin actually needs.
- **Validate Input:** Always validate and sanitize user input before using it in commands or UI.
- **Secure Communication:** Use HTTPS for any network requests.
- **Dependency Management:** Keep your plugin's dependencies updated to avoid known vulnerabilities.

## Secure Coding at Shoal

The core application follows several security principles:

- **Context Isolation:** The renderer process is sandboxed and isolated from Node.js APIs, and only the app's own document may call the IPC bridge.
- **Secure IPC:** All communication between processes happens over a secure IPC bridge with pre-defined handlers.
- **Command Sanitization:** All shell commands are carefully constructed to prevent injection attacks. Manifests handed to kubectl go through private temporary files (owner-only, unguessable names).
- **Sandboxed Plugin UI:** Plugin interfaces run in opaque-origin iframes with a strict Content Security Policy (sent as a header with every plugin file as well) and no network access; the frames cannot navigate away from their host document, and their files are served only from plugin directories. An end-to-end test (`e2e/features/sandbox-escape.spec.ts`) installs a plugin that tries to get out (host DOM, top-level navigation, popups, network, clipboard, Node globals, bridge calls beyond its permissions, navigating its own frame) and checks that every attempt is blocked.
- **Plugin code and the trust boundary:** A plugin's Node entry runs in a `vm` context with a module allowlist and, for user-installed plugins, in its own utility process with a minimal environment. That is isolation against mistakes, not against a hostile plugin: Node's `vm` is not a security boundary. The boundary is the signature: installed builds only run plugins signed with the Shoal key, so a plugin is trusted code, and its declared permissions decide what the `PluginContext` lets it do (reading cluster resources and resource events need `kubernetes`; Secrets travel to plugins without their data).
- **Navigation Guards:** The app window cannot open new windows or navigate away from the app; web links open in the system browser, and only one instance runs per profile.
- **Permissions:** Web permission requests (camera, microphone, location, notifications and so on) are denied; only clipboard writes are allowed.
- **Hardened Binary:** Electron fuses disable running the executable as plain Node.js and `NODE_OPTIONS`, and the app only loads from its integrity-checked `app.asar`.
- **Signed Plugins:** Installed builds only load plugins whose signature covers every file of the plugin, code included. The ids of the bundled plugins cannot be reused by imported plugins, and the `MARKETPLACE_PUBLIC_KEY` override of the signing key is honoured only in development builds, never in installed ones.
- **Release Integrity:** The GitHub Actions workflows that build and publish releases pin every action to a commit, so a moved tag cannot change what runs with the release token. Releases are not code-signed yet (see [Installers](#installers)). Auto-update downloads from GitHub Releases and checks the sha512 published with the release; the Windows installer and the AppImage ask GitHub Releases once on every start for the latest version (that request carries no identifier, only the version being checked) and install the update on quit. The portable build and the `.deb` never check.
- **Debugging flag:** The `--inspect` Node flag stays enabled in the shipped binary (the `EnableNodeCliInspectArguments` fuse) because the release smoke test drives the installed app with Playwright, which needs it. It gives whoever can already run commands as you a debugger on the main process, nothing more than that user already has; it will be reconsidered once the installers are code-signed.
- **Linux sandbox:** On Ubuntu 24.04, AppArmor restricts the unprivileged user namespaces that Chromium's sandbox needs, so the AppImage starts with `--no-sandbox` and runs without Chromium's OS-level sandbox (the renderer and plugin sandboxes above still apply). The `.deb` package installs an AppArmor profile that keeps the sandbox; prefer it on Ubuntu 24.04.
