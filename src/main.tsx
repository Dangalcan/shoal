import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { ApiProvider } from './services/api-context'
import { ClusterProvider } from './features/clusters/ClusterContext'
import '../styles/index.css'
import { PluginProvider } from './features/plugins/PluginProvider';
import { PluginRuntime } from './features/plugins/PluginRuntime';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <ApiProvider>
                <ClusterProvider>
                    <PluginProvider>
                        <PluginRuntime />
                        <App />
                    </PluginProvider>
                </ClusterProvider>
            </ApiProvider>
        </ErrorBoundary>
    </React.StrictMode>,
)
