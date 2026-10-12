# Security Policy

## Supported Versions

The following versions of Shoal are currently supported with security updates:

| Version        | Supported          |
| -------------- | ------------------ |
| Latest release | :white_check_mark: |
| Older releases | :x:                |

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
- **Only install plugins from trusted sources:** Plugins have significant access to your system and clusters.
- **Review plugin permissions:** Check what a plugin asks for before installing it.
- **Kubeconfig Safety:** Your `.kube/config` file contains sensitive credentials. Ensure it's stored securely and not shared.

### For Plugin Developers

- **Follow the Security Guidelines:** Read the [Plugin Development Guide](docs/PLUGINS_GUIDE.md) for security best practices.
- **Principle of Least Privilege:** Only request the permissions your plugin actually needs.
- **Validate Input:** Always validate and sanitize user input before using it in commands or UI.
- **Secure Communication:** Use HTTPS for any network requests.
- **Dependency Management:** Keep your plugin's dependencies updated to avoid known vulnerabilities.

## Secure Coding at Shoal

The core application follows several security principles:

- **Context Isolation:** The renderer process is sandboxed and isolated from Node.js APIs.
- **Secure IPC:** All communication between processes happens over a secure IPC bridge with pre-defined handlers.
- **Command Sanitization:** All shell commands are carefully constructed to prevent injection attacks.
- **Sandboxed Plugin UI:** Plugin interfaces run in opaque-origin iframes with a strict Content Security Policy and no network access; their files are served only from plugin directories.
- **Navigation Guards:** The app window cannot open new windows or navigate away from the app; web links open in the system browser, and only one instance runs per profile.
- **Permissions:** Web permission requests (camera, microphone, location, notifications and so on) are denied; only clipboard writes are allowed.
- **Hardened Binary:** Electron fuses disable running the executable as plain Node.js and `NODE_OPTIONS`, and the app only loads from its integrity-checked `app.asar`.
- **Signed Plugins:** Installed builds only load plugins whose signature covers every file of the plugin, code included. The ids of the bundled plugins cannot be reused by imported plugins, and the `MARKETPLACE_PUBLIC_KEY` override of the signing key is honoured only in development builds, never in installed ones.
- **Release Integrity:** Releases are not code-signed yet. Download installers only from this repository's GitHub Releases page.
- **Linux sandbox:** On Ubuntu 24.04, AppArmor restricts the unprivileged user namespaces that Chromium's sandbox needs, so the AppImage starts with `--no-sandbox` and runs without Chromium's OS-level sandbox (the renderer and plugin sandboxes above still apply). The `.deb` package installs an AppArmor profile that keeps the sandbox; prefer it on Ubuntu 24.04.
