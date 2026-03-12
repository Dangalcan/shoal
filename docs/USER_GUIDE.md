# User Guide 📖

Welcome to **Kubernetes Desktop**, your modern cockpit for Kubernetes management. This guide covers everything you need to know to get started.

## Table of Contents

- [Getting Started](#getting-started)
- [Cluster Management](#cluster-management)
- [Managing Resources](#managing-resources)
- [Manifests](#manifests)
- [Using Plugins](#using-plugins)
- [Settings & Configuration](#settings--configuration)

---

## Getting Started

### Installation

1. Download the latest installer for your operating system from the [Releases page](https://github.com/Dangalcan/Kubernetes-Desktop/releases).
2. Install the application:
   - **Windows**: Run the `.exe` installer.
   - **macOS**: Drag the app to your `Applications` folder.
   - **Linux**: Use the `.deb/.rpm` package or run the `.AppImage`.

### The Dashboard

Upon launching, you will be greeted by the **Dashboard**. This view provides a high-level overview of your connected clusters and the current health of your local environment.

---

## Cluster Management

### Creating a New Cluster

Kubernetes Desktop makes it easy to spin up local development clusters.

1. Click on **"Create Cluster"** in the left sidebar.
2. Select your preferred provider (**kind**, **minikube**, or **k3d**).
3. Give your cluster a name and configure the number of nodes.
4. Click **"Create"**. The application will handle the setup in the background.

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

---

## Manifests

The **Manifests** page lets you store, edit, and apply Kubernetes resource manifests (YAML) directly from the UI without leaving the application.

### Saving a Manifest

1. Navigate to **"Manifests"** in the sidebar.
2. Click **"New Manifest"** (or the `+` button).
3. Give it a name and paste or type your YAML content.
4. Click **"Save"**. The manifest is persisted in the local SQLite database.

You can also **drag and drop** a `.yaml` or `.json` file onto the editor, or use the file upload button to import from disk.

### Editing a Manifest

Click the **edit** icon next to any saved manifest to open it in the editor. Make your changes and click **"Save"**.

### Applying a Manifest

Click the **play** icon (▶) next to a manifest to run `kubectl apply` against the **currently active** cluster context. The result (success or error output) is displayed inline.

### Deleting a Manifest

Click the **trash** icon and confirm the deletion.

---

## Using Plugins

Plugins allow you to extend the functionality of Kubernetes Desktop.

### Installing Plugins

1. Go to the **"Plugins"** section in the sidebar.
2. Browse the **Marketplace** for extensions like "Advanced Log Viewer" or "Network Topology".
3. Click **"Install"**.

### Managing Licenses

For paid or trial plugins:

1. Navigate to the **"Installed Plugins"** tab.
2. Click **"Activate"** to enter your license key or start a trial period.

---

## Settings & Configuration

Click on **"Settings"** in the sidebar to customize your experience:

- **Theme**: Switch between Dark and Light mode.
- **Kubeconfig Path**: Update the path to your `.kube/config` if it's stored in a non-standard location.
- **Refresh Interval**: Adjust how often the UI polls for resource changes.
- **Developer Mode**: Enable this to load unpacked plugins from your local machine (for developers).

---

## Support & Feedback

- **Report a Bug**: Open an issue on [GitHub](https://github.com/Dangalcan/Kubernetes-Desktop/issues).
- **Propose a Feature**: Use our feature request template on GitHub.
- **Discussions**: Join the community in [GitHub Discussions](https://github.com/Dangalcan/Kubernetes-Desktop/discussions).
