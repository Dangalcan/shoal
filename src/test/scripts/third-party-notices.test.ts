// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import path from 'path';

interface PackageEntry {
  dir: string;
  pkg: { name: string; version: string };
}
interface NoticesModule {
  BUNDLED_DEV_PACKAGES: string[];
  BUNDLED_RENDERER_PACKAGES: string[];
  collectPackages: (root: string, extraNames?: string[]) => PackageEntry[];
  render: (entries: PackageEntry[]) => string;
  generate: (output: string, root: string) => { output: string; count: number };
}

const notices = createRequire(import.meta.url)(
  '../../../scripts/third-party-notices.js'
) as NoticesModule;

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

/** Renderer source files: src/ without the tests and the type declarations. */
function listRendererSources(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'test') listRendererSources(full, out);
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !/\.test\.tsx?$/.test(entry.name) &&
      !entry.name.endsWith('.d.ts')
    ) {
      out.push(full);
    }
  }
  return out;
}

/** Package names imported by a source file (bare specifiers only). */
function importedPackages(source: string): string[] {
  const names = new Set<string>();
  for (const line of source.split('\n')) {
    const match =
      line.match(/\bfrom\s+['"]([^'"]+)['"]/) ??
      line.match(/^\s*import\s+['"]([^'"]+)['"]/);
    const specifier = match?.[1];
    if (!specifier || specifier.startsWith('.')) continue;
    const parts = specifier.split('/');
    names.add(
      specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
    );
  }
  return [...names];
}

function writePackage(
  dir: string,
  pkg: object,
  files: Record<string, string> = {}
) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
  for (const [name, text] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), text);
  }
}

describe('third-party notices', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-notices-'));
    writePackage(root, { name: 'app', dependencies: { a: '^1.0.0' } });
    writePackage(
      path.join(root, 'node_modules', 'a'),
      {
        name: 'a',
        version: '1.0.0',
        license: 'MIT',
        dependencies: { b: '^2.0.0' },
        optionalDependencies: { 'other-platform': '^1.0.0' },
      },
      { LICENSE: 'A license text' }
    );
    writePackage(path.join(root, 'node_modules', 'a', 'node_modules', 'b'), {
      name: 'b',
      version: '2.0.0',
      license: 'ISC',
    });
    writePackage(path.join(root, 'node_modules', 'c'), {
      name: 'c',
      version: '3.0.0',
      license: 'MIT',
      author: { name: 'Ana' },
    });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('follows dependencies, nested installs and extra bundled packages', () => {
    const names = notices.collectPackages(root, ['c']).map((e) => e.pkg.name);
    expect(names).toEqual(['a', 'b', 'c']);
  });

  it('skips missing optional dependencies but fails on missing required ones', () => {
    expect(() => notices.collectPackages(root, ['not-installed'])).toThrow(
      'Cannot find installed package "not-installed"'
    );
  });

  it('reproduces license files and falls back to the MIT text', () => {
    const text = notices.render(notices.collectPackages(root, ['c']));
    expect(text).toContain('Packages: 3');
    expect(text).toContain('a 1.0.0\nLicense: MIT');
    expect(text).toContain('A license text');
    expect(text).toContain('Copyright (c) Ana');
    expect(text).toContain('Permission is hereby granted');
    expect(text).toContain('Its package.json declares: ISC.');
  });

  it('writes the notices file, including Tailwind CSS and the renderer libraries by default', () => {
    for (const name of notices.BUNDLED_DEV_PACKAGES) {
      writePackage(path.join(root, 'node_modules', name), {
        name,
        version: '4.0.0',
        license: 'MIT',
      });
    }
    const output = path.join(root, 'out', 'THIRD_PARTY_NOTICES.txt');

    const result = notices.generate(output, root);

    expect(result).toEqual({
      output,
      count: 2 + notices.BUNDLED_DEV_PACKAGES.length,
    });
    const text = fs.readFileSync(output, 'utf8');
    expect(text).toContain('tailwindcss 4.0.0');
    expect(text).toContain('react 4.0.0');
    expect(text).toContain('@xterm/xterm 4.0.0');
  });

  it('lists every library the renderer imports, so its notices ship', () => {
    const rootPkg = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')
    ) as { dependencies: Record<string, string> };
    const declared = new Set([
      ...Object.keys(rootPkg.dependencies),
      ...notices.BUNDLED_DEV_PACKAGES,
    ]);
    const undeclared = new Set<string>();
    for (const file of listRendererSources(path.join(REPO_ROOT, 'src'))) {
      for (const name of importedPackages(fs.readFileSync(file, 'utf8'))) {
        if (!declared.has(name)) undeclared.add(name);
      }
    }

    // A new renderer import must go into BUNDLED_RENDERER_PACKAGES (and
    // devDependencies) or into dependencies; otherwise its license is missing
    // from the installers.
    expect([...undeclared]).toEqual([]);
    expect(notices.BUNDLED_RENDERER_PACKAGES).toEqual(
      [...notices.BUNDLED_RENDERER_PACKAGES].sort()
    );
  });
});
