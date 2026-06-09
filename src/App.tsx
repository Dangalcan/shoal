import { HashRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './layouts/Layout'
import { Dashboard } from './pages/Dashboard'
import { CreateCluster } from './pages/CreateCluster'
import { Clusters } from './pages/Clusters'
import { ClusterDetails } from './pages/ClusterDetails'
import { Settings } from './pages/Settings'
import Plugins from './pages/Plugins'
import { PluginPage } from './pages/PluginPage'
import { Manifests } from './pages/Manifests'
import { TerminalPage } from './pages/TerminalPage'

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
                    <Route path="terminal" element={<TerminalPage />} />
                </Route>
            </Routes>
        </HashRouter>
    )
}

export default App
