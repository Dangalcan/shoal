import { HashRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './layouts/Layout'
import { Dashboard } from './pages/Dashboard'
import { CreateCluster } from './pages/CreateCluster'

function App() {
    return (
        <HashRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="create-cluster" element={<CreateCluster />} />
                    <Route path="clusters" element={<div className="p-8"><h2 className="text-2xl font-bold">Clusters</h2></div>} />
                    <Route path="settings" element={<div className="p-8"><h2 className="text-2xl font-bold">Settings</h2></div>} />
                </Route>
            </Routes>
        </HashRouter>
    )
}

export default App
