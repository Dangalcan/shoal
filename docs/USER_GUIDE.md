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
   - **Linux**: Make the `.AppImage` executable (`chmod +x Shoal-<version>.AppImage`) and run it, or install the `.deb` package (`sudo apt install ./shoal_<version>_amd64.deb`). The AppImage updates itself; the `.deb` does not.
     - The AppImage needs `libfuse2`, which Ubuntu 22.04 and later do not install by default: `sudo apt install libfuse2` (`libfuse2t64` on Ubuntu 24.04).
     - On Ubuntu 24.04 AppArmor blocks Chromium's sandbox for AppImages, so the AppImage starts without it. The `.deb` installs an AppArmor profile and keeps the sandbox; prefer it there.

### Requirements

Shoal drives your clusters through the usual command-line tools, which you install separately:

- **kubectl** (required for everything cluster-related). If it is missing, the Dashboard and Clusters pages say so and link to the install guide.
- **kind** or **k3d**, plus **Docker** running, to create local clusters. Create Cluster checks both and tells you what is missing.
- **kompose** (Docker Compose migration), optional.

After installing a tool, press **Check again**. On Linux Shoal also looks in the usual install locations (`/usr/local/bin`, `~/.local/bin`, `/snap/bin`, Homebrew...) even when it is started from the desktop menu. On Windows, **Check again** re-reads the user and system `PATH` from the registry, so a tool installed while Shoal was running is found without a restart; terminals that were already open keep the old `PATH` until you open a new one.

### The Dashboard

Upon launching, you will be greeted by the **Dashboard**. It shows a summary of the active context, whether Docker or Podman is installed and running, and the widgets of the enabled plugins. The sun or moon button at the bottom of the sidebar switches between the light and dark theme.

---

## Cluster Management

### Creating a New Cluster

Shoal makes it easy to spin up local development clusters.

1. Open **"Clusters"** in the left sidebar and click **"Create Cluster"**.
2. Select your preferred provider (**kind** or **k3d**). If its CLI is missing, or Docker is not running, a notice explains what to install or start.
3. Give your cluster a name.
4. Click **"Create Cluster"**. The application will handle the setup in the background.

### Switching Contexts

If you have multiple clusters, you can switch between them with the context switcher at the top of the sidebar. The active context determines which cluster's resources are displayed.

### Deleting a Cluster or Removing a Context

The trash icon on a cluster card deletes kind and k3d clusters (containers included). For any other context it only removes the entry from your kubeconfig; the cluster itself is untouched. The dialog says which of the two will happen.

---

## Managing Resources

### Exploring Pods, Services, and More

Navigate to **"Clusters"** in the sidebar to see a list of your connected clusters. Each card shows the tool behind the context when its name tells (`kind-…` or `k3d-…`), or "kubeconfig context" for any other cluster. Click on any cluster to enter the **Cluster Details** view.

- **Namespace Filter**: Use the dropdown at the top to filter resources by namespace (e.g., `default`, `kube-system`). The namespace selected on start comes from **Default Namespace** in Settings.
- **Resource Tabs**: Switch between the resource kinds: workloads (Pods, Deployments, ReplicaSets, DaemonSets, StatefulSets, Jobs, CronJobs), networking (Services, Ingresses, EndpointSlices, NetworkPolicies), configuration (ConfigMaps, Secrets, ServiceAccounts), storage (PVs, PVCs, StorageClasses), RBAC, cluster objects (Nodes, Events, CRDs) and more. The gear button lets you hide tabs and columns you do not use.
- **Refresh**: Tables refresh on their own at the interval set in Settings (**Auto-Refresh Data**), or on demand with the refresh button.

### Resource Actions

Hover a row to reveal its action buttons:

- **Describe** and **YAML**: Inspect the resource as `kubectl describe` and `kubectl get -o yaml` show it.
- **Logs**: Show the last 200 lines of a pod's log, with a search box. Logs are fetched on demand, not streamed; reopen the viewer for newer lines.
- **Rollout Restart** and **Delete**: Perform rollouts or deletions directly from the UI, after a confirmation.
- **Scale**: Set the replica count for Deployments, StatefulSets, and ReplicaSets (0–1000).
- **Open Shell**: Start a terminal session inside a pod (see [Terminal](#terminal)).
- **Forward Port**: Open a `kubectl port-forward` tunnel to a pod or service (see [Port Forwarding](#port-forwarding)).

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
2. Hover a **Pod** row and click **"Open Shell"**.
3. A new session starts inside the pod's default container using `/bin/sh` (you can choose a different shell for containers that ship one, e.g. `/bin/bash`).
4. The session is bound to the pod's lifecycle — if the pod restarts, the session ends.

### Notes

- Sessions run without a pseudo-terminal (PTY): resizing the window does not resize the shell, and full-screen programs such as `vim` or `top` may not display correctly.
- **Ctrl+C** stops the command running in the shell (for example `ping` or `kubectl logs -f`) and leaves the shell open.
- Each session is independent; multiple sessions are not currently supported from a single Terminal page visit.
- Open sessions are closed when Shoal quits.

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

Shoal ships with two example plugins, **Namespace Watcher** (namespace stats and events) and **Resource Monitor** (CPU, memory and restarts per pod, needs a metrics server in the cluster). They are enabled the first time you start the app. From the **"Plugins"** section in the sidebar you can disable or enable them, change their settings (the gear on the card) and reload them.

Both plugins add a page to the sidebar; Resource Monitor also adds a widget to the Dashboard.

### Other Plugins

Installed builds of the 0.9 beta only run plugins signed with the Shoal key, which means the two bundled ones. **Load Unpacked Plugin** checks the signature before copying anything and refuses an unsigned plugin. To develop a plugin, run Shoal from source (`npm run dev`), which loads unsigned plugins; see the [Plugin Developer Guide](PLUGINS_GUIDE.md).

> **Planned for 1.0:** the plugin marketplace (browse, install and update plugins from inside the app), signing for third-party plugins, paid plugins, trials and licenses. In the 0.9 beta the Marketplace tab is hidden.

---

## Settings & Configuration

Click on **"Settings"** in the sidebar to customize your experience:

- **Kubeconfig Path**: Point Shoal at a kubeconfig stored in a non-standard location (several files can be joined with the OS path separator). The file must exist; the path is saved and restored when Shoal starts.
- **Default Namespace**: The namespace the resource tables select when you open a cluster (`All Namespaces`, `default`, or any namespace of the active context).
- **Auto-Refresh Data** and **Refresh Interval**: Whether the UI polls for resource changes, and how often.
- **About & Support**: Shows your Shoal version and platform, and lets you check for updates, open the logs folder, or report a problem.

The light or dark theme is switched with the sun or moon button at the bottom of the sidebar.

---

## App Updates

Shoal updates itself automatically from GitHub Releases:

- When a new version is found, a toast tells you it is downloading in the background.
- Once downloaded, a persistent **"Restart"** prompt appears — click it to install the update and relaunch. You can also keep working and the update installs on the next app restart.
- To check right away, use **Settings → About & Support → Check for updates**. The portable Windows version and the `.deb` package cannot update themselves: download the new release instead.

---

## Support & Feedback

- **Report a Bug**: Use **Settings → About & Support → Report a problem** (also offered on the error screen). It opens a GitHub issue prefilled with your version and OS; nothing is sent until you submit it.
- **Logs**: Errors are written to a local `main.log` (Windows `%APPDATA%\Shoal\logs`, Linux `~/.config/Shoal/logs`). **Open logs folder** takes you there; attach the file to your issue if you are comfortable sharing it. Shoal sends no telemetry or crash reports.
- **Propose a Feature**: Use our feature request template on GitHub.
- **Discussions**: Join the community in [GitHub Discussions](https://github.com/Dangalcan/shoal/discussions).
