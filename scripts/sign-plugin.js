/**
 * Plugin Signing Script
 *
 * Usage:
 *   node scripts/sign-plugin.js <path-to-plugin-directory>
 *
 * Signs the whole plugin, not only its manifest: hashes every file in the
 * directory (SHA-256), signs the resulting file list with the private key, and
 * writes both to plugin.json.sig (signature format 2, see
 * electron/services/security/plugin-integrity.ts). The app refuses a plugin
 * whose files no longer match, so re-sign after ANY change to the plugin.
 *
 * IMPORTANT: Keep the private key secret. Never commit it to source control.
 * Store it in a secrets manager (e.g. GitHub Actions secrets, Vault, 1Password).
 *
 * Set the PLUGIN_SIGNING_KEY env var to the PEM private key, or place the key
 * at the path defined by PLUGIN_SIGNING_KEY_PATH (default: ~/.shoal-signing-key.pem).
 *
 * Hashes cover the exact bytes on disk. Format plugin.json (Prettier) before
 * signing, and keep the bundled plugins LF-only (see .gitattributes), or a
 * Windows checkout will no longer match.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SIGNATURE_FILE = 'plugin.json.sig';
const SIGNATURE_FORMAT = 'shoal-plugin-signature/2';

/** Relative POSIX path -> SHA-256 hex of every file except the signature. */
function hashPluginFiles(pluginDir) {
  const files = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(pluginDir, full).split(path.sep).join('/');
      if (entry.isSymbolicLink()) {
        throw new Error(`Symbolic links are not allowed in plugins: ${rel}`);
      }
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && rel !== SIGNATURE_FILE) {
        files[rel] = crypto
          .createHash('sha256')
          .update(fs.readFileSync(full))
          .digest('hex');
      }
    }
  };
  walk(pluginDir);
  return files;
}

/** Must match canonicalPayload() in plugin-integrity.ts byte for byte. */
function canonicalPayload(files) {
  const lines = Object.keys(files)
    .sort()
    .map((rel) => `${files[rel]}  ${rel}\n`);
  return `${SIGNATURE_FORMAT}\n${lines.join('')}`;
}

/** Signs `pluginDir` and writes plugin.json.sig. Returns the signed list. */
function signPlugin(pluginDir, privateKeyPem) {
  if (!fs.existsSync(path.join(pluginDir, 'plugin.json'))) {
    throw new Error(`No plugin.json found in: ${pluginDir}`);
  }
  const files = hashPluginFiles(pluginDir);
  const signature = crypto
    .sign('sha256', Buffer.from(canonicalPayload(files)), privateKeyPem)
    .toString('hex');
  const content = { format: SIGNATURE_FORMAT, files, signature };
  fs.writeFileSync(
    path.join(pluginDir, SIGNATURE_FILE),
    `${JSON.stringify(content, null, 2)}\n`
  );
  return content;
}

function loadPrivateKey() {
  if (process.env.PLUGIN_SIGNING_KEY) return process.env.PLUGIN_SIGNING_KEY;
  const keyPath =
    process.env.PLUGIN_SIGNING_KEY_PATH ||
    path.join(os.homedir(), '.shoal-signing-key.pem');
  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `Private key not found. Set PLUGIN_SIGNING_KEY or place it at: ${keyPath}`
    );
  }
  return fs.readFileSync(keyPath, 'utf-8');
}

module.exports = { hashPluginFiles, canonicalPayload, signPlugin };

if (require.main === module) {
  const pluginDir = process.argv[2];
  if (!pluginDir) {
    console.error('Usage: node scripts/sign-plugin.js <plugin-directory>');
    process.exit(1);
  }
  try {
    const { files } = signPlugin(pluginDir, loadPrivateKey());
    console.log(`Signed ${Object.keys(files).length} files in ${pluginDir}`);
    console.log(
      `Signature written to: ${path.join(pluginDir, SIGNATURE_FILE)}`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
