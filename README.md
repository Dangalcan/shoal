# Kubernetes Desktop

A modern, desktop-based management tool for Kubernetes clusters and container runtimes, inspired by Docker Desktop. Built with Electron, React, TypeScript, and Vite.

## 🏗 Architecture

**Kubernetes Desktop** follows a secure, multi-process architecture typical of Electron applications:

1.  **Main Process** (`electron/`): 
    -   Runs the application lifecycle (window creation, app events).
    -   Acts as the secure bridge to the operating system.
    -   Executes shell commands (like `docker`, `podman`, `kind`) via Node.js `child_process`.
    -   Exposes limited, secure capabilities to the UI via **IPC** (Inter-Process Communication).

2.  **Renderer Process** (`src/`):
    -   Runs the React UI.
    -   **Sandboxed**: No direct access to Node.js APIs (fs, child_process, etc.).
    -   Communicates with the Main Process using the `window.electron` bridge defined in `preload.ts`.

### IPC Bridge Pattern

The frontend requests actions (like "Check Docker Status") by calling:
`window.electron.checkTool('docker')`

This is routed securely:
`UI (React) -> preload.ts -> IPC Channel -> Main Process (executes command) -> IPC Response -> UI`

## 📂 Project Structure

```bash
Kubernetes-Desktop/
├── electron/               # ⚡ Main Process Source
│   ├── main.ts            # Entry point, Window setup, IPC handlers
│   ├── preload.ts         # ContextBridge (Security layer)
│   └── tsconfig.json      # Main process TS config
├── src/                    # ⚛️ Renderer Source (React)
│   ├── components/        # Reusable UI components (Sidebar, etc.)
│   ├── layouts/           # Page layouts (Main Layout with Sidebar)
│   ├── pages/             # View components (Dashboard, CreateCluster)
│   ├── lib/               # Utilities (CSS helpers, formatting)
│   ├── main.tsx           # React entry point
│   ├── App.tsx            # Main Router setup
│   └── index.css          # Global styles (Tailwind imports)
├── dist-electron/          # 📦 Compiled Main Process (Output)
├── dist/                   # 📦 Compiled Renderer (Output)
├── .gitignore             # Git options
├── package.json           # Dependencies and scripts configuration
├── postcss.config.cjs     # PostCSS Config (Tailwind v4 adapter)
├── tailwind.config.cjs    # Tailwind CSS Configuration
└── vite.config.ts         # Vite build configuration
```

## 🛠 Tech Stack

-   **Runtime**: [Electron](https://www.electronjs.org/)
-   **Frontend**: [React 19](https://react.dev/)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **Build Tool**: [Vite](https://vitejs.dev/)
-   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
-   **Icons**: [Lucide React](https://lucide.dev/)
-   **Routing**: [React Router](https://reactrouter.com/)

## 🚀 Getting Started

### Prerequisites
-   Node.js (v18+)
-   Docker or Podman (optional, for functionality checks)

### Development

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Run the development server (starts both React and Electron):
    ```bash
    npm run dev
    ```

### Production Build

To verify that the application compiles correctly for production:

```bash
npm run build
```
This produces the distribution files in `dist/` and `dist-electron/`.
