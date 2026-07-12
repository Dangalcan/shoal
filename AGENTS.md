# Kubernetes Desktop — Project Rules for Codex

## Project Overview

Kubernetes Desktop is an Electron + React 19 + TypeScript desktop application for managing Kubernetes clusters. It follows a multi-process architecture with IPC-based communication between the Main Process (`electron/`) and the Renderer Process (`src/`).

## Architecture

```
UI (React) → preload.ts → IPC Channel → Main Process → IPC Response → UI
```

- **Main Process** (`electron/`): Node.js access, shell commands, database, plugin system
- **Renderer Process** (`src/`): Sandboxed React app, no direct Node.js access
- **IPC Bridge** (`electron/preload.ts`): `window.electron.*` API surface

## Key Conventions

### TypeScript

- **`@typescript-eslint/no-explicit-any: error`** — never use `any` without explicit eslint-disable
- Use interfaces in `types.ts` or `types.d.ts` files
- All IPC methods return `Promise<Result<T>>` where `Result<T> = { success: boolean; data?: T; error?: string }`

### File Naming

- Components: `PascalCase.tsx`
- Hooks: `use[Name].ts`
- Services: `[name]-service.ts`
- IPC handlers: `[name]-ipc.ts`
- Tests: `[name].test.ts` or `[name].test.tsx`
- Styles: `[ComponentName].scss`

### Frontend Patterns

- Use `useApi()` hook — never access `window.electron` directly
- Use `handleAsyncOperation()` for user-triggered actions (loading → success/error toasts)
- Use `useAsyncData()` for data fetching with auto-refresh
- Use `cn()` from `src/lib/utils.ts` to merge CSS classes
- Functional components with hooks — no class components
- Pages should be thin wrappers; business logic lives in `src/features/` hooks

### Backend (Electron) Patterns

- All IPC handlers use `wrapIpcHandler()` from `electron/ipc/ipc-utils.ts`
- Always validate inputs with `assertContext()`, `assertNamespace()`, `assertResourceName()`, `assertResourceType()` before running commands
- Use `safe-exec.ts` for shell commands — `execFile` only, no `shell: true`
- Keep IPC handlers thin; complex logic goes in `electron/services/`

### Styling

- SCSS + Tailwind CSS dual system
- BEM naming for SCSS: `.block__element--modifier`
- Design tokens as CSS variables in `styles/variables.scss`
- Dark mode via `[data-theme='dark']` selector
- Use `@use` not `@import` in SCSS

### Commits

Follow Conventional Commits: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `chore:`, `ci:`

Optional scope: `(cluster)`, `(plugin)`, `(ui)`, `(electron)`, `(marketplace)`, `(docs)`

### Testing

- **Unit/Integration**: Vitest 4 + React Testing Library (`npm test`)
- **E2E**: Playwright on production Electron builds (`npm run test:e2e`)
- **Coverage thresholds**: Lines 90%, Statements 90%, Functions 90%, Branches 80%
- Always mock the Electron bridge via `createMockElectronAPI()`

### Linting

```bash
npm run lint          # Check ESLint + Prettier
npm run lint:fix      # Auto-fix
```

### Common Commands

```bash
npm run dev           # Start dev (React + Electron + Marketplace)
npm test              # Run Vitest tests
npm run test:coverage # Coverage report
npm run test:e2e      # Playwright E2E
npm run build         # Production build
npm run lint:fix      # Fix lint errors
```
