# User Guide 📖

Welcome to **Shoal**, your modern cockpit for Kubernetes management. This guide covers everything you need to know to get started.

## Table of Contents

- [Getting Started](#getting-started)
- [Cluster Management](#cluster-management)
- [Managing Resources](#managing-resources)
- [Manifests](#manifests)
- [Migrating from Docker Compose](#migrating-from-docker-compose)
- [Terminal](#terminal)
- [Port Forwarding](#port-forwarding)
- [Using Plugins](#using-plugins)
- [Settings & Configuration](#settings--configuration)
- [App Updates](#app-updates)

---

## Getting Started

### Installation

Shoal 0.9 is a public beta for **Windows** and **Linux** (macOS arrives with 1.0).

1. Download the latest release from the [Releases page](https://github.com/Dangalcan/shoal/releases).
2. Install the application:
   - **Windows**: Run `Shoal-Setup-<version>.exe`. The installer is not code-signed yet, so SmartScreen may show "Windows protected your PC": choose **More info → Run anyway**. Prefer no install? Use `Shoal-<version>-portable.exe` (it does not update itself).
   - **Linux**: Make the `.AppImage` executable (`chmod +x Shoal-<version>.AppImage`) and run it, or install the `.deb` package.

### Requirements

Shoal drives your clusters through the usual command-line tools, which you install separately:

- **kubectl** (required for everything cluster-related). If it is missing, the Dashboard and Clusters pages say so and link to the install guide.
- **kind** or **k3d**, plus **Docker** running, to create local clusters. Create Cluster checks both and tells you what is missing.
- **helm** (Helm features) and **kompose** (Docker Compose migration), optional.

After installing a tool, press **Check again**. On Linux and macOS Shoal also looks in the usual install locations (`/usr/local/bin`, `~/.local/bin`, `/snap/bin`, Homebrew...) even when it is started from the desktop menu. On Windows, restart Shoal after installing a tool so it sees the updated `PATH`.

### The Dashboard

Upon launching, you will be greeted by the **Dashboard**. This view provides a high-level overview of your connected clusters and the current health of your local environment.

---

## Cluster Management

### Creating a New Cluster

Shoal makes it easy to spin up local development clusters.

1. Click on **"Create Cluster"** in the left sidebar.
2. Select your preferred provider (**kind** or **k3d**). If its CLI is missing, or Docker is not running, a notice explains what to install or start.
3. Give your cluster a name.
4. Click **"Create Cluster"**. The application will handle the setup in the background.

### Switching Contexts

If you have multiple clusters, you can switch between them using the context selector in the top navigation bar. The active context determines which cluster's resources are displayed.

---

## Managing Resources

### Exploring Pods, Services, and More

Navigate to **"Clusters"** in the sidebar to see a list of your connected clusters. Click on any cluster to enter the **Cluster Details** view.

- **Namespace Filter**: Use the dropdown at the top to filter resources by namespace (e.g., `default`, `kube-system`).
- **Resource Tabs**: Quickly switch between Pods, Services, Deployments, and ConfigMaps.

### Resource Actions

Click on a resource name to view more options:

- **YAML View**: Inspect the live YAML manifest of the resource.
- **Logs**: Stream live logs from your containers.
- **Restart/Delete**: Safely perform rollouts or deletions directly from the UI.
- **Scale**: Set the replica count for Deployments, StatefulSets, and ReplicaSets (0–1000).
- **Port Forward**: Open a `kubectl port-forward` tunnel to a pod or service (see [Port Forwarding](#port-forwarding)).

---

## Manifests

The **Manifests** page lets you store, edit, and apply Kubernetes resource manifests (YAML) directly from the UI without leaving the application.

### Saving a Manifest

1. Navigate to **"Manifests"** in the sidebar.
2. Click **"New Manifest"** (or the `+` button).
3. Give it a name and paste or type your YAML content.
4. Click **"Save"**. The manifest is persisted in the local SQLite database.

You can also **drag and drop** a `.yaml` or `.json` file onto the editor, or use the file upload button to import from disk.

### Starting from a Template

When creating a new manifest, you can pick one of the built-in **templates** (Deployment, Service, ConfigMap, and more) instead of starting from a blank editor, then adjust the YAML to your needs.

### Organizing with Folders

Manifests can be organized into **nested folders**, similar to a file explorer:

- Create a folder with the **"New Folder"** button; folders can be nested inside each other.
- **Move** manifests (and whole folders) between folders or back to the root.
- When deleting a folder you choose between moving its contents up to the parent, or deleting the folder **and everything inside it**.

### Editing a Manifest

Click the **edit** icon next to any saved manifest to open it in the editor. Make your changes and click **"Save"**.

### Applying a Manifest

Click the **play** icon (▶) next to a manifest to run `kubectl apply` against the **currently active** cluster context. The result (success or error output) is displayed inline.

### Deleting a Manifest

Click the **trash** icon and confirm the deletion.

---

## Migrating from Docker Compose

The **Migrate** page converts a `docker-compose.yml` file into Kubernetes manifests using the [kompose](https://kompose.io) CLI.

1. Install kompose and make sure it is on your `PATH` (the page shows install instructions if it is not detected).
2. Click **"Migrate"** in the sidebar, then **"Select compose file"** and pick your `.yml`/`.yaml` file (up to 1 MiB).
3. Review the conversion result:
   - One Kubernetes resource per generated manifest (Deployments, Services, ...).
   - **Warnings** for compose keys kompose could not convert.
   - A list of **locally built images** (services with a `build:` key) — a cluster cannot pull these, so load or push them to a registry first.
4. Import the manifests. They are saved into a new **manifest folder** named after your project, tied to the selected cluster context, and you are taken to the Manifests page to review and apply them.

---

## Terminal

The **Terminal** page provides direct shell access — either a local shell on your machine or an interactive session inside a running pod.

### Opening a Local Shell

1. Click **"Terminal"** in the left sidebar.
2. A local shell session opens automatically using your default shell.
3. Use the **shell picker** to switch to any other shell detected on your machine — PowerShell, PowerShell 7, Git Bash, or WSL on Windows; `bash`, `zsh`, or `sh` on Linux.
4. Type commands as normal. Press **Ctrl+C** to interrupt a running process.
5. Close the session with the **Kill** button or by typing `exit`.

### Opening a Pod Exec Session

1. Navigate to a cluster's **Cluster Details** view.
2. Click on a **Pod** row to open its action menu.
3. Select **"Open Terminal"**. A new session starts inside the pod's default container using `/bin/sh` (you can choose a different shell for containers that ship one, e.g. `/bin/bash`).
4. The session is bound to the pod's lifecycle — if the pod restarts, the session ends.

### Notes

- Sessions run without a pseudo-terminal (PTY): resizing the window does not resize the shell, and full-screen programs such as `vim` or `top` may not display correctly.
- Each session is independent; multiple sessions are not currently supported from a single Terminal page visit.

---

## Port Forwarding

Port forwarding opens a local tunnel to a pod or service in your cluster (`kubectl port-forward`), so you can reach it at `localhost:<port>`.

### Starting a Tunnel

1. In **Cluster Details**, open the action menu of a **Pod** or **Service** and choose **"Port Forward"**.
2. Pick the remote (container/service) port — exposed ports are suggested automatically — and a free local port.
3. Click **"Start"**. The tunnel stays open until you stop it or quit the app.

### Managing Tunnels

Click **"Port Forwards"** in the sidebar to see every active tunnel, with its local and remote port, target, and start time. Stop any tunnel from there. If a tunnel dies on its own (for example the pod was deleted), you get a notification.

---

## Using Plugins

Plugins allow you to extend the functionality of Shoal.

### Included Plugins

Shoal ships with two example plugins, **Namespace Watcher** and **Resource Monitor**. They are enabled the first time you start the app; you can disable them from the **"Plugins"** section in the sidebar.

> **Beta note:** the plugin marketplace, paid plugins and licenses arrive with Shoal 1.0. In the 0.9 beta the Marketplace tab is hidden and the sections below do not apply yet.

### Installing Plugins

1. Go to the **"Plugins"** section in the sidebar.
2. Browse the **Marketplace** for extensions like "Advanced Log Viewer" or "Network Topology".
3. Click **"Install"**.

### Buying Paid Plugins

1. In the **Marketplace**, click **"Buy"** on a paid plugin.
2. A checkout page opens in your browser — complete the payment there.
3. Back in the app, the purchase is detected automatically: your license is activated and the plugin is installed. No manual key entry needed.

If the payment is cancelled or times out, nothing is installed and you can retry.

### Managing Licenses

For paid or trial plugins:

1. Navigate to the **"Installed Plugins"** tab.
2. Click **"Activate"** to enter your license key or start a trial period (14 days, one per machine per plugin).
3. You can also **deactivate** a license on the current machine to use it elsewhere.

---

## Settings & Configuration

Click on **"Settings"** in the sidebar to customize your experience:

- **Theme**: Switch between Dark and Light mode.
- **Kubeconfig Path**: Point Shoal at a kubeconfig stored in a non-standard location (several files can be joined with the OS path separator). The file must exist; the path is saved and restored when Shoal starts.
- **Refresh Interval**: Adjust how often the UI polls for resource changes.
- **About & Support**: Shows your Shoal version and platform, and lets you check for updates, open the logs folder, or report a problem.

---

## App Updates

Shoal updates itself automatically from GitHub Releases:

- When a new version is found, a toast tells you it is downloading in the background.
- Once downloaded, a persistent **"Restart"** prompt appears — click it to install the update and relaunch. You can also keep working and the update installs on the next app restart.
- To check right away, use **Settings → About & Support → Check for updates**. The portable Windows version cannot update itself: download the new release instead.

---

## Support & Feedback

- **Report a Bug**: Use **Settings → About & Support → Report a problem** (also offered on the error screen). It opens a GitHub issue prefilled with your version and OS; nothing is sent until you submit it.
- **Logs**: Errors are written to a local `main.log` (Windows `%APPDATA%\Shoal\logs`, Linux `~/.config/Shoal/logs`). **Open logs folder** takes you there; attach the file to your issue if you are comfortable sharing it. Shoal sends no telemetry or crash reports.
- **Propose a Feature**: Use our feature request template on GitHub.
- **Discussions**: Join the community in [GitHub Discussions](https://github.com/Dangalcan/shoal/discussions).
