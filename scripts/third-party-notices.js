/**
 * Third-Party Notices
 *
 * Usage:
 *   node scripts/third-party-notices.js [output-file]
 *
 * Also runs automatically as the electron-builder `beforePack` hook, so every
 * package build gets a fresh file.
 *
 * Writes the license notices of every package that ships inside Shoal: the
 * production dependency tree (what electron-builder packs into app.asar and
 * what Vite bundles into the renderer) plus Tailwind CSS, whose base styles end
 * up in the generated stylesheet. electron-builder strips LICENSE files from
 * node_modules, so without this file the installers would carry no notices.
 * Electron and Chromium notices ship separately (LICENSE.electron.txt and
 * LICENSES.chromium.html next to the executable).
 *
 * Default output: build/THIRD_PARTY_NOTICES.txt (gitignored), packaged as an
 * extraResource next to LICENSE.txt, COPYING.txt and COPYRIGHT.txt.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT = path.join(ROOT, 'build', 'THIRD_PARTY_NOTICES.txt');

// Build-time packages whose output is bundled into the app.
const BUNDLED_DEV_PACKAGES = ['tailwindcss'];

const LICENSE_FILE = /^(licen[cs]e|copying|notice)([.-].*)?$/i;

const MIT_TEXT = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Node's lookup: <dir>/node_modules/<name>, then each parent up to root. */
function findPackageDir(name, fromDir, root) {
  const stop = path.resolve(root);
  let dir = path.resolve(fromDir);
  for (;;) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (dir === stop) return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Packages reachable from the root's `dependencies` plus `extraNames`,
 * following `dependencies` and installed `optionalDependencies`.
 */
function collectPackages(root, extraNames = BUNDLED_DEV_PACKAGES) {
  const rootPkg = readJson(path.join(root, 'package.json'));
  const queue = [...Object.keys(rootPkg.dependencies || {}), ...extraNames].map(
    (name) => ({ name, from: root, optional: false })
  );
  const seen = new Map();

  while (queue.length > 0) {
    const { name, from, optional } = queue.shift();
    const dir = findPackageDir(name, from, root);
    if (!dir) {
      if (!optional) throw new Error(`Cannot find installed package "${name}"`);
      continue; // optional dependency for another platform
    }
    if (seen.has(dir)) continue;
    const pkg = readJson(path.join(dir, 'package.json'));
    seen.set(dir, { dir, pkg });
    for (const dep of Object.keys(pkg.dependencies || {})) {
      queue.push({ name: dep, from: dir, optional: false });
    }
    for (const dep of Object.keys(pkg.optionalDependencies || {})) {
      queue.push({ name: dep, from: dir, optional: true });
    }
  }

  return [...seen.values()].sort((a, b) =>
    `${a.pkg.name}@${a.pkg.version}`.localeCompare(
      `${b.pkg.name}@${b.pkg.version}`
    )
  );
}

function licenseOf(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && pkg.license.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) {
    return pkg.licenses.map((l) => l.type || l).join(' OR ');
  }
  return 'UNKNOWN';
}

function authorOf(pkg) {
  if (!pkg.author) return null;
  return typeof pkg.author === 'string' ? pkg.author : pkg.author.name || null;
}

/** License text for one package: its own files, or the SPDX text for MIT. */
function noticeText({ dir, pkg }) {
  const files = fs
    .readdirSync(dir)
    .filter(
      (f) => LICENSE_FILE.test(f) && fs.statSync(path.join(dir, f)).isFile()
    )
    .sort();
  if (files.length > 0) {
    return files
      .map((f) => fs.readFileSync(path.join(dir, f), 'utf8').trim())
      .join('\n\n');
  }
  if (licenseOf(pkg) === 'MIT') {
    const author = authorOf(pkg);
    const holder = author ? `Copyright (c) ${author}\n\n` : '';
    return `${holder}${MIT_TEXT}`;
  }
  return `The package ships no license file. Its package.json declares: ${licenseOf(pkg)}.`;
}

function render(entries) {
  const rule = '-'.repeat(78);
  const header = [
    'Shoal third-party notices',
    '',
    'Shoal includes the open source packages listed below. Each is distributed',
    'under its own license, reproduced here. Electron and Chromium notices are in',
    'LICENSE.electron.txt and LICENSES.chromium.html next to the Shoal executable.',
    '',
    `Packages: ${entries.length}`,
  ].join('\n');
  const blocks = entries.map((entry) => {
    const { pkg } = entry;
    const source =
      pkg.homepage ||
      (pkg.repository && (pkg.repository.url || pkg.repository));
    return [
      rule,
      `${pkg.name} ${pkg.version}`,
      `License: ${licenseOf(pkg)}`,
      ...(source ? [`Source: ${source}`] : []),
      '',
      noticeText(entry),
    ].join('\n');
  });
  return `${[header, ...blocks].join('\n\n')}\n`;
}

function generate(output = DEFAULT_OUTPUT, root = ROOT) {
  const entries = collectPackages(root);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, render(entries));
  return { output, count: entries.length };
}

module.exports = { collectPackages, noticeText, render, generate };

// electron-builder `beforePack` hook.
module.exports.default = async function beforePack() {
  const { output, count } = generate();
  console.log(
    `  • third-party notices  packages=${count} file=${path.relative(ROOT, output)}`
  );
};

if (require.main === module) {
  const { output, count } = generate(
    process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUTPUT
  );
  console.log(`Wrote ${count} package notices to ${output}`);
}
