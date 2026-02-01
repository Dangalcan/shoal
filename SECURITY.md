# Security Policy

## Supported Versions

The following versions of Kubernetes Desktop are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Kubernetes Desktop seriously. If you believe you have found a security vulnerability, please report it to us responsibly.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to **security@kubernetes-desktop.com**.

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

1. **Acknowledgement:** You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.
2. **Investigation:** We will investigate the issue and may ask for additional information.
3. **Resolution:** If a vulnerability is confirmed, we will work on a fix.
4. **Public Disclosure:** Once a fix is available and tested, we will release a new version. We will coordinate the public disclosure with you to give credit where it's due.

## Security Best Practices

### For Users

- **Keep Kubernetes Desktop up to date:** Always use the latest version to ensure you have the latest security patches.
- **Only install plugins from trusted sources:** Plugins have significant access to your system and clusters.
- **Review plugin permissions:** Check what a plugin asks for before installing it.
- **Kubeconfig Safety:** Your `.kube/config` file contains sensitive credentials. Ensure it's stored securely and not shared.

### For Plugin Developers

- **Follow the Security Guidelines:** Read the [Plugin Development Guide](docs/PLUGINS_GUIDE.md) for security best practices.
- **Principle of Least Privilege:** Only request the permissions your plugin actually needs.
- **Validate Input:** Always validate and sanitize user input before using it in commands or UI.
- **Secure Communication:** Use HTTPS for any network requests.
- **Dependency Management:** Keep your plugin's dependencies updated to avoid known vulnerabilities.

## Secure Coding at Kubernetes Desktop

The core application follows several security principles:

- **Context Isolation:** The renderer process is sandboxed and isolated from Node.js APIs.
- **Secure IPC:** All communication between processes happens over a secure IPC bridge with pre-defined handlers.
- **Command Sanitization:** All shell commands are carefully constructed to prevent injection attacks.
- **Code Signing:** Official releases are signed to ensure authenticity and integrity.
