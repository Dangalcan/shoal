// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

interface PackageEntry {
  dir: string;
  pkg: { name: string; version: string };
}
interface NoticesModule {
  collectPackages: (root: string, extraNames?: string[]) => PackageEntry[];
  render: (entries: PackageEntry[]) => string;
  generate: (output: string, root: string) => { output: string; count: number };
}

const notices = createRequire(import.meta.url)(
  '../../../scripts/third-party-notices.js'
) as NoticesModule;

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

  it('writes the notices file, including Tailwind CSS by default', () => {
    writePackage(path.join(root, 'node_modules', 'tailwindcss'), {
      name: 'tailwindcss',
      version: '4.0.0',
      license: 'MIT',
    });
    const output = path.join(root, 'out', 'THIRD_PARTY_NOTICES.txt');

    const result = notices.generate(output, root);

    expect(result).toEqual({ output, count: 3 });
    expect(fs.readFileSync(output, 'utf8')).toContain('tailwindcss 4.0.0');
  });
});
