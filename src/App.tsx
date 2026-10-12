import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './layouts/Layout';
import { Dashboard } from './pages/Dashboard';
import { CreateCluster } from './pages/CreateCluster';
import { Clusters } from './pages/Clusters';
import { ClusterDetails } from './pages/ClusterDetails';
import { Settings } from './pages/Settings';
import Plugins from './pages/Plugins';
import { PluginPage } from './pages/PluginPage';
import { Manifests } from './pages/Manifests';
import { Migration } from './pages/Migration';
import { TerminalPage } from './pages/TerminalPage';
import { PortForwards } from './pages/PortForwards';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="create-cluster" element={<CreateCluster />} />
          <Route path="clusters" element={<Clusters />} />
          <Route path="cluster/:name" element={<ClusterDetails />} />
          <Route path="settings" element={<Settings />} />
          <Route path="plugins" element={<Plugins />} />
          <Route path="plugin/:pluginId" element={<PluginPage />} />
          <Route path="manifests" element={<Manifests />} />
          <Route path="migration" element={<Migration />} />
          <Route path="terminal" element={<TerminalPage />} />
          <Route path="port-forwards" element={<PortForwards />} />
          {/* Unknown routes (e.g. a stale hash) land on the dashboard. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
