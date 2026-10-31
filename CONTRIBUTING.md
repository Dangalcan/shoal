# Contributing to Shoal

Thank you for your interest in contributing to Shoal! This document provides guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Pull Requests](#pull-requests)
- [Development Setup](#development-setup)
- [Development Guidelines](#development-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Code Review Process](#code-review-process)
- [License](#license)

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md). We are committed to providing a welcoming and inclusive environment for all contributors.

## How to Contribute

### Reporting Bugs

Before creating a bug report:

1. Check the [existing issues](https://github.com/Dangalcan/shoal/issues) to see if the bug has already been reported
2. Make sure you're using the latest version of the application

When creating a bug report, please include:

- **Clear title and description** of the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs actual behavior
- **Screenshots** (if applicable)
- **Environment details:**
  - OS and version (e.g., Windows 11, Ubuntu 24.04)
  - Application version and platform (Settings → About & Support shows both) and how you installed it
  - Relevant lines from `main.log` (Settings → About & Support → Open logs folder)

The issue form on GitHub asks for exactly these fields, and **Settings → About & Support → Report a problem** opens it with the version, OS and logs path already filled in.

**Example:**

````markdown
**Bug:** Cluster creation fails with kind provider

**Steps to reproduce:**

1. Open Clusters and click "Create Cluster"
2. Enter name "test-cluster"
3. Select "kind" as provider
4. Click "Create Cluster"

**Expected:** Cluster should be created successfully
**Actual:** Error message "kind is not installed or not on the PATH"

**Environment:**

- OS: Windows 11
- App Version: 0.9.0 (Setup.exe)

**Logs:**

```
[error] [Cluster] kind create cluster: kind is not installed or not on the PATH
```
````

### Suggesting Features

We welcome feature suggestions! Before creating a feature request:

1. Check [existing issues](https://github.com/Dangalcan/shoal/issues) to see if it's already been suggested
2. Check the [roadmap](README.md#-roadmap) to see if it's already planned

When creating a feature request, please include:

- **Clear title and description** of the feature
- **Problem statement:** What problem does this solve?
- **Proposed solution:** How should it work?
- **Alternatives considered:** What other approaches did you consider?
- **Additional context:** Mockups, examples, or references

**Example:**

```markdown
**Feature:** Add Helm release management

**Problem:** Users need to manage Helm releases but currently have to use CLI

**Proposed Solution:**

- Add "Helm" section in sidebar
- List all Helm releases in current cluster
- Show release details (chart, version, status)
- Provide upgrade/rollback/uninstall actions

**Alternatives:**

- Integrate with existing resource views
- Add as a plugin instead of core feature

**Mockup:**
[Attach screenshot or wireframe]
```

### Pull Requests

We love pull requests! Here's how to submit one:

1. **Fork the repository** and create your branch from `master`
2. **Follow our development guidelines** (see below)
3. **Write tests** for your changes
4. **Ensure tests pass:** `npm run test`
5. **Run the linter:** `npm run lint:fix`
6. **Update documentation** if needed
7. **Write a clear commit message** following our guidelines
8. **Submit the pull request**

#### Pull Request Checklist

Before submitting, make sure:

- [ ] Code follows the project's style guidelines
- [ ] Tests are written and passing
- [ ] Documentation is updated (if applicable)
- [ ] Commit messages follow conventional commits format
- [ ] No linting errors
- [ ] Branch is up to date with `master`

## Development Setup

### Prerequisites

- Node.js v22.12+
- npm v9+
- Git

### Setup Steps

1. **Fork and clone the repository:**

   ```bash
   git clone https://github.com/YOUR_USERNAME/shoal.git
   cd shoal
   ```

2. **Install dependencies and the git hooks:**

   ```bash
   npm install
   npm run prepare
   ```

   The project `.npmrc` turns dependency install scripts off: npm would
   otherwise try to compile better-sqlite3 (npm/cli#9837) although it ships
   prebuilt binaries, which fails without a C++ toolchain. The same setting
   skips `prepare`, so `npm run prepare` installs the husky pre-commit hook.
   If a dependency you add needs its install script, run
   `npm rebuild <package>` and mention it in your PR.

3. **Start development server:**

   ```bash
   npm run dev
   ```

   This starts:
   - Vite dev server (React app) on `http://localhost:5173`
   - Electron main process (the marketplace tab uses the sample catalog in
     `electron/data/marketplace.json`)

4. **Open Developer Tools** (development builds only):
   - Press `Ctrl+Shift+I`
   - View console logs and debug. The main process logs to `main.log` (Settings → About & Support → Open logs folder)

## Development Guidelines

### Architecture

Please read our architecture guides before contributing:

- [Feature Development Guide](docs/CONTRIBUTING_FEATURES.md) - How to add new features
- [Styling Guide](docs/CONTRIBUTING_STYLES.md) - CSS architecture and conventions
- [Testing Guide](docs/CONTRIBUTING_TESTS.md) - How to write tests

### Key Principles

1. **Separation of Concerns:**
   - UI components in `src/components/`
   - Business logic in `src/features/` (custom hooks)
   - Backend logic in `electron/services/`

2. **Type Safety:**
   - Use TypeScript for all new code
   - Define interfaces in `types.ts` files
   - Avoid `any` types

3. **Testing:**
   - Write tests for all new features
   - Maintain minimum coverage thresholds (90% lines/statements/functions, 80% branches)
   - Test both happy paths and error cases

4. **Error Handling:**
   - Use `handleError()` utility for consistent error display
   - Provide meaningful error messages
   - Log errors appropriately

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix
```

CI runs `npm run lint:eslint` and `npm run lint:prettier`, so a pull request
with an ESLint error or unformatted files fails (ESLint warnings are
allowed). The promise rules are type-aware and errors everywhere
(`@typescript-eslint/no-floating-promises`, `no-misused-promises`,
`await-thenable`): await a promise, return it, report its failure in a
`.catch` (a toast through `handleError`, or the error state the caller
already keeps), or mark a deliberate fire-and-forget with `void` when the
callee reports its own failures, with a short comment when that is not
obvious. The pre-commit hook formats staged files, lints the staged
`.js`, `.jsx`, `.ts` and `.tsx` files and type-checks both processes; the
full test suite and the type check of the test files (`npm run
typecheck:test`, `tsconfig.test.json`) run in CI. `any` is an error in `src/` and
`electron/` (use a typed shape, or `isRecord()` from `src/lib/type-guards.ts`
for unknown API fields) and allowed in tests and e2e specs. Line endings are
LF everywhere (`.gitattributes`); on Windows, git converts on checkout, so
no editor setting is needed.

**Key conventions:**

- Use functional components with hooks (React)
- Use async/await instead of promises
- Use descriptive variable names
- Add comments for complex logic
- Follow BEM naming for CSS classes

### File Naming

- **Components:** `PascalCase.tsx` (e.g., `ClusterCard.tsx`)
- **Hooks:** `use[Name].ts` (e.g., `useClusters.ts`)
- **Types:** `types.ts` or `[feature].types.ts`
- **Tests:** `[name].test.tsx` or `[name].test.ts`
- **Styles:** `[ComponentName].scss` (BEM classes, `@use` imports)

## Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, missing semicolons, etc.)
- `refactor:` Code refactoring (no functional changes)
- `perf:` Performance improvements
- `test:` Adding or updating tests
- `chore:` Maintenance tasks (dependencies, build config, etc.)
- `ci:` CI/CD changes

### Scope (Optional)

The scope specifies what part of the codebase is affected:

- `cluster` - Cluster management
- `plugin` - Plugin system
- `ui` - UI components
- `electron` - Main process
- `marketplace` - Marketplace client (hidden in 0.9)
- `docs` - Documentation

### Examples

```bash
# Simple feature
feat: add cluster health monitoring

# Feature with scope
feat(plugin): add plugin marketplace UI

# Bug fix
fix: resolve memory leak in plugin loader

# Documentation
docs: update API reference

# Breaking change
feat!: change plugin API structure

BREAKING CHANGE: Plugin context API has been restructured.
Plugins must update their activate() function signature.
```

### Rules

- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize first letter
- No period at the end
- Keep subject line under 72 characters
- Add body for complex changes
- Reference issues: `Closes #123` or `Fixes #456`

## Code Review Process

1. **Automated Checks:**
   - Tests must pass
   - Linting must pass
   - Coverage thresholds must be met

2. **Maintainer Review:**
   - A maintainer will review your PR
   - They may request changes or ask questions
   - Address feedback promptly

3. **Approval and Merge:**
   - Once approved, a maintainer will merge your PR
   - Your contribution will be included in the next release

### Review Timeline

Shoal is maintained by one person in their spare time, so reviews are best
effort: expect a first response within a week or two, and a merge once the
review is done and every check passes. Feel free to ping the pull request if
it goes quiet.

## Getting Help

If you need help with your contribution:

- 📖 Read the [documentation](docs/)
- 💬 Ask in [GitHub Discussions](https://github.com/Dangalcan/shoal/discussions)
- 🐛 Check [existing issues](https://github.com/Dangalcan/shoal/issues)

## Recognition

Contributions are credited in the changelog and the release notes. Thank you for making Shoal better!

## License

By contributing to Shoal, you agree that your contributions will be licensed under the LGPL-3.0-or-later License.

New runtime dependencies must use a license compatible with LGPL-3.0 (MIT, ISC, BSD, Apache-2.0 and similar; no GPL or AGPL). Their notices are added to `THIRD_PARTY_NOTICES.txt` automatically when the app is packaged (`scripts/third-party-notices.js`).

Where a package goes depends on who loads it. The main process requires its packages from `app.asar` at run time, so they are `dependencies`. The renderer's libraries (`react`, `react-dom`, `react-router-dom`, `lucide-react`, `sonner`, `clsx`, `tailwind-merge`, `@xterm/*`) are bundled by Vite into `dist/`, so they are `devDependencies` and are listed in `BUNDLED_RENDERER_PACKAGES` in `scripts/third-party-notices.js`; that keeps their notices in the installers without packing a second copy of the code. A test fails when the renderer imports a package that is in neither list, and ESLint stops the main process from importing a renderer library.
