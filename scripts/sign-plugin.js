/**
 * Plugin Signing Script
 *
 * Usage:
 *   node scripts/sign-plugin.js <path-to-plugin-directory>
 *
 * Reads plugin.json from the given directory, signs it with the private key,
 * and writes the signature to plugin.json.sig next to it.
 *
 * IMPORTANT: Keep the private key secret. Never commit it to source control.
 * Store it in a secrets manager (e.g. GitHub Actions secrets, Vault, 1Password).
 *
 * Set the PLUGIN_SIGNING_KEY env var to the PEM private key, or place the key
 * at the path defined by PLUGIN_SIGNING_KEY_PATH (default: ~/.kd-signing-key.pem).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const pluginDir = process.argv[2];
if (!pluginDir) {
  console.error('Usage: node scripts/sign-plugin.js <plugin-directory>');
  process.exit(1);
}

const manifestPath = path.join(pluginDir, 'plugin.json');
if (!fs.existsSync(manifestPath)) {
  console.error(`No plugin.json found at: ${manifestPath}`);
  process.exit(1);
}

// Load private key from env var or file
let privateKeyPem;
if (process.env.PLUGIN_SIGNING_KEY) {
  privateKeyPem = process.env.PLUGIN_SIGNING_KEY;
} else {
  const keyPath =
    process.env.PLUGIN_SIGNING_KEY_PATH ||
    path.join(os.homedir(), '.kd-signing-key.pem');
  if (!fs.existsSync(keyPath)) {
    console.error(
      `Private key not found. Set PLUGIN_SIGNING_KEY env var or place it at: ${keyPath}`
    );
    process.exit(1);
  }
  privateKeyPem = fs.readFileSync(keyPath, 'utf-8');
}

const manifestContent = fs.readFileSync(manifestPath, 'utf-8');

const sign = crypto.createSign('sha256');
sign.update(manifestContent);
sign.end();
const signature = sign.sign(privateKeyPem, 'hex');

const sigPath = path.join(pluginDir, 'plugin.json.sig');
fs.writeFileSync(sigPath, signature);

console.log(`Signed: ${manifestPath}`);
console.log(`Signature written to: ${sigPath}`);
