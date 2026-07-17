# Kubernetes Desktop

[![License](https://img.shields.io/badge/license-LGPL-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](.version)
[![Electron](https://img.shields.io/badge/electron-39.2.7-blue.svg)](https://electronjs.org)
[![React](https://img.shields.io/badge/react-19.2.3-blue.svg)](https://react.dev)

A modern, desktop-based management tool for Kubernetes clusters and container runtimes, inspired by Docker Desktop. Built with Electron, React, TypeScript, and Vite.

## Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Development](#development)
- [Plugin System](#-plugin-system)
- [Marketplace Backend](#-marketplace-backend)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [Troubleshooting](#-troubleshooting)
- [License](#license)

## ✨ Features

### Cluster Management

- 🚀 Create clusters using kind, minikube, or k3d
- 📋 List and manage multiple clusters
- 🔄 Switch between kubeconfig contexts
- 🗑️ Delete clusters safely

### Resource Management

- 👁️ View Kubernetes resources (Pods, Services, Deployments, etc.)
- 🔍 Filter by namespace
- 📊 Real-time resource status updates
- 📝 View resource YAML and logs
- 🔄 Rollout restart for Deployments, DaemonSets, StatefulSets
- ⚖️ Scale Deployments, StatefulSets, and ReplicaSets to any replica count
- 🗑️ Delete any resource directly from the UI

### Manifest Management

- 📄 Save and edit YAML manifests in a built-in editor
- 🗂️ Organize manifests into nested folders (Drive-like hierarchy)
- 📑 Start from ready-made manifest templates (Deployment, Service, ConfigMap, ...)
- 📂 Drag-and-drop YAML/JSON file import
- ▶️ Apply manifests to the active cluster with one click
- 💾 Persisted locally in SQLite

### Migration

- 🚚 Convert `docker-compose.yml` files into Kubernetes manifests via [kompose](https://kompose.io)
- 📥 Import the converted resources into the manifest library for review before applying

### Terminal

- 💻 Local shell sessions with a shell picker (PowerShell, PowerShell 7, Git Bash, WSL on Windows; bash, zsh, sh on macOS/Linux)
- 🐚 Pod exec (`kubectl exec`) sessions inside any running container
- 📐 Resizable terminal with interrupt support

### Port Forwarding

- 🔌 Start and stop `kubectl port-forward` tunnels to pods and services
- 📡 Manage all active tunnels from a dedicated page, with automatic notification when a tunnel dies

### Plugin System (Beta)

- 🔌 Extensible plugin architecture with sandboxed plugin UI
- 🛒 Marketplace for free and paid plugins, with in-app checkout for purchases
- 🔐 Secure plugin signing and verification
- 💳 License management for commercial plugins (trials, activation, deactivation)
- 🎨 UI extensions (sidebar items, pages, resource actions, dashboard widgets)

### App Updates

- ⬆️ In-app auto-update via `electron-updater` and GitHub Releases

### Developer Tools

- 🧪 Comprehensive test suite (90%+ coverage)
- 📚 Detailed contribution guides
- 🎯 Type-safe IPC communication
- 🔧 Hot-reload development mode

## 🏗 Architecture

**Kubernetes Desktop** follows a secure, multi-process architecture typical of Electron applications:

1.  **Main Process** (`electron/`):
    - Runs the application lifecycle (window creation, app events).
    - Acts as the secure bridge to the operating system.
    - Executes shell commands (like `docker`, `podman`, `kind`) via Node.js `child_process`.
    - Exposes limited, secure capabilities to the UI via **IPC** (Inter-Process Communication).

2.  **Renderer Process** (`src/`):
    - Runs the React UI.
    - **Sandboxed**: No direct access to Node.js APIs (fs, child_process, etc.).
    - Communicates with the Main Process using the `window.electron` bridge defined in `preload.ts`.

### IPC Bridge Pattern

The frontend requests actions (like "Check Docker Status") by calling:
`window.electron.checkTool('docker')`

This is routed securely:
`UI (React) -> preload.ts -> IPC Channel -> Main Process (executes command) -> IPC Response -> UI`

## 📂 Project Structure

```bash
Kubernetes-Desktop/
├── electron/               # ⚡ Main Process Source
│   ├── main.ts            # Entry point, window setup
│   ├── preload.ts         # ContextBridge — secure IPC surface
│   ├── database.ts        # SQLite setup (manifests)
│   ├── ipc/               # IPC handler modules (cluster, resources, plugins, manifests, migration, terminal, portforward, update)
│   ├── services/          # Business logic
│   │   ├── cluster/       # Kind/K3d cluster management
│   │   ├── kubernetes/    # kubectl API wrapper
│   │   ├── plugins/       # Plugin manager, loader, registry, context, events, sandbox
│   │   ├── marketplace/   # Marketplace HTTP client
│   │   ├── migration/     # Docker Compose → Kubernetes conversion (kompose)
│   │   ├── portforward/   # kubectl port-forward tunnel manager
│   │   ├── terminal/      # Local & pod-exec shell sessions
│   │   ├── update/        # electron-updater integration
│   │   └── security/      # License manager, signature verification, encryption
│   ├── types/             # Shared TypeScript types (plugin-types.ts, migration-types.ts)
│   └── tsconfig.json      # Main process TS config
├── src/                    # ⚛️ Renderer Source (React)
│   ├── components/        # Reusable UI components (tables, modals, sidebar, terminal)
│   ├── features/          # Feature modules (plugins, marketplace, manifests, terminal)
│   ├── hooks/             # Custom React hooks
│   ├── layouts/           # Page layouts
│   ├── pages/             # Route-level components (Dashboard, Clusters, Manifests, Migration, Plugins, PortForwards, Terminal, Settings)
│   ├── services/          # Frontend API service layer & plugin UI registry
│   ├── types/             # Frontend TypeScript interfaces
│   ├── lib/               # Utilities and resource definitions
│   ├── App.tsx            # React Router setup
│   └── main.tsx           # React entry point
├── marketplace-backend/    # 🛒 Dev-only mock of the marketplace API (production uses kdMarket)
├── plugins/               # 🔌 Bundled example plugins (8 plugins)
├── styles/                # 🎨 SCSS stylesheets (variables, animations, components)
├── e2e/                   # 🎭 Playwright end-to-end tests
├── scripts/               # 🔧 Build and utility scripts
├── dist-electron/          # 📦 Compiled Main Process (output)
├── dist/                   # 📦 Compiled Renderer (output)
├── package.json           # Dependencies and npm scripts
├── vite.config.ts         # Vite renderer build config
├── vitest.config.ts       # Unit test configuration
├── playwright.config.ts   # E2E test configuration
├── tailwind.config.cjs    # Tailwind CSS v4 configuration
└── postcss.config.cjs     # PostCSS config (Tailwind adapter)
```

## 🛠 Tech Stack

- **Runtime**: [Electron](https://www.electronjs.org/)
- **Frontend**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/) + [electron-builder](https://www.electron.build/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + SCSS
- **Icons**: [Lucide React](https://lucide.dev/)
- **Routing**: [React Router v7](https://reactrouter.com/)
- **Database**: [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (manifests & plugin registry)
- **Terminal**: [xterm.js](https://xtermjs.org/) frontend over spawned shell processes
- **Auto-Update**: [electron-updater](https://www.electron.build/auto-update) (GitHub Releases)
- **Notifications**: [Sonner](https://sonner.emilkowal.ski/) (toasts)
- **Testing**: [Vitest 4](https://vitest.dev/) (unit) + [Playwright](https://playwright.dev/) (E2E)
- **Marketplace Backend**: [Express.js](https://expressjs.com/) + JWT

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ ([Download](https://nodejs.org/))
- **npm** v9+ (comes with Node.js)
- **Docker** or **Podman** (optional, for container runtime features)
- **kubectl** (optional, for Kubernetes cluster management)
- **kind**, **minikube**, or **k3d** (optional, for local cluster creation)

#### Platform-Specific Requirements

**Windows:**

- Windows 10 or later
- PowerShell 5.1 or later

**macOS:**

- macOS 10.13 or later

**Linux:**

- Ubuntu 20.04+ or equivalent
- X11 or Wayland display server

### Installation

Download the latest release for your platform from [Releases](https://github.com/Dangalcan/Kubernetes-Desktop/releases).

### Development

1.  Install dependencies:

    ```bash
    npm install
    ```

2.  Run the development server (starts React, Electron, and Marketplace Backend):
    ```bash
    npm run dev
    ```

### Production Build

To verify that the application compiles correctly for production:

```bash
npm run build
```

This produces the distribution files in `dist/` and `dist-electron/`.

## 🔌 Plugin System

Kubernetes Desktop features a powerful plugin system that allows developers to extend functionality.

### Plugin Types

- **Free Plugins:** Open-source plugins (MIT, Apache-2.0, LGPL-3)
- **Paid Plugins:** Commercial plugins with licensing
- **Trial Plugins:** Try before you buy

### Plugin Capabilities

Plugins can:

- Add sidebar navigation items
- Register custom pages
- Add resource action buttons
- Access Kubernetes API
- Store persistent data
- Show notifications

### For Plugin Developers

See the [Plugin Developer Guide](docs/PLUGINS_GUIDE.md) for detailed information on creating plugins.

**Example Plugin Structure:**

```javascript
module.exports = {
  activate: (context) => {
    // Register UI elements
    context.ui.registerSidebarItem({
      id: 'my-plugin',
      label: 'My Plugin',
      route: '/plugin/my-plugin',
    });

    // Show notification
    context.ui.showNotification('Plugin activated!', 'success');
  },

  deactivate: () => {
    console.log('Plugin deactivated');
  },
};
```

### Plugin Marketplace

The marketplace provides:

- Plugin discovery and search
- Secure plugin downloads
- License management (trials, activation, deactivation)
- Paid plugin checkout — pay in the browser, license activates automatically
- Reviews and ratings

For more information, see [Plugin Architecture](docs/PLUGIN_ARCHITECTURE.md).

## 🛒 Marketplace Backend

The plugin ecosystem is powered by **kdMarket**, a standalone, contract-first marketplace API (separate repository) serving under a `/v1` base URL. It provides:

- RESTful API for the plugin catalog (search, filter, pagination)
- License key validation and JWT-based license generation
- Trial period activation and tracking
- Checkout sessions for paid plugin purchases
- Admin endpoints for managing license keys and catalog entries
- Rate limiting and Helmet security middleware

The app selects the backend via the `MARKETPLACE_BACKEND_URL` environment variable (e.g. `http://localhost:3001/v1` for a local kdMarket).

### In-repo mock backend

The bundled [marketplace-backend/](marketplace-backend/README.md) directory is a **dev-only, catalog-only mock** kept as an offline fallback — do not build new features against it. It serves at the bare root (`http://localhost:3001`, no `/v1`):

```bash
cd marketplace-backend
npm install
cp .env.example .env
npm run dev
```

## 🧪 Testing

Kubernetes Desktop maintains high test coverage standards:

| Metric     | Minimum Threshold |
| ---------- | ----------------- |
| Lines      | 90%               |
| Statements | 90%               |
| Functions  | 90%               |
| Branches   | 80%               |

### Running Tests

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# UI mode
npm run test:ui
```

For more information, see the [Testing Guide](docs/CONTRIBUTING_TESTS.md).

## 📦 Deployment

### Building for Production

```bash
npm run build
```

This creates:

- `dist/` - Compiled renderer (React app)
- `dist-electron/` - Compiled main process
- Platform-specific installers (via electron-builder)

### Platform-Specific Builds

```bash
# Windows
npm run build -- --win

# macOS
npm run build -- --mac

# Linux
npm run build -- --linux
```

### Distribution

The build process creates platform-specific installers:

- **Windows:** `.exe` installer
- **macOS:** `.dmg` disk image
- **Linux:** `.AppImage`, `.deb`, and `.rpm` packages

## 🤝 Contributing

We welcome contributions! Please see our contribution guides:

- [Feature Development Guide](docs/CONTRIBUTING_FEATURES.md)
- [Styling Guide](docs/CONTRIBUTING_STYLES.md)
- [Testing Guide](docs/CONTRIBUTING_TESTS.md)
- [Plugin Development Guide](docs/PLUGINS_GUIDE.md)

### Quick Start for Contributors

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/Kubernetes-Desktop.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature`
5. Make your changes
6. Run tests: `npm run test`
7. Run linter: `npm run lint:fix`
8. Commit your changes: `git commit -m "feat: your feature"`
9. Push to your fork: `git push origin feature/your-feature`
10. Open a Pull Request

### Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

## 🔧 Troubleshooting

### Common Issues

**Issue: Electron window doesn't open**

```bash
# Clear cache and rebuild
rm -rf node_modules dist dist-electron
npm install
npm run dev
```

**Issue: kubectl commands fail**

- Ensure kubectl is installed and in PATH
- Verify kubeconfig is properly configured: `kubectl config view`
- Check cluster connectivity: `kubectl cluster-info`

**Issue: Plugin won't load**

- Check plugin manifest (`plugin.json`) is valid
- Verify plugin permissions
- Check Developer Console (Ctrl+Shift+I or Cmd+Option+I) for errors
- Try disabling and re-enabling the plugin

**Issue: Tests failing**

```bash
# Clear Vitest's cache, then re-run
rm -rf node_modules/.vite
npm run test
```

**Issue: Marketplace backend won't start**

```bash
cd marketplace-backend
# Check if .env file exists
ls -la .env
# Copy example if missing
cp .env.example .env
npm run dev
```

### Getting Help

- 📖 Check the [documentation](docs/)
- 🐛 Report bugs via [GitHub Issues](https://github.com/Dangalcan/Kubernetes-Desktop/issues)
- 💬 Ask questions in [Discussions](https://github.com/Dangalcan/Kubernetes-Desktop/discussions)

## License

LGPL License - see [LICENSE](LICENSE) for details.
