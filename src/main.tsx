import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { ApiProvider } from './services/api-context'
import { ClusterProvider } from './features/clusters/ClusterContext'
import '../styles/tailwind.css'
import '../styles/index.scss'
import { PluginProvider } from './features/plugins/PluginProvider';
import { PluginNotifications } from './features/plugins/PluginNotifications';
import { installGlobalErrorHandlers } from './lib/error-reporting';

// Uncaught errors and unhandled rejections go to the main log file.
installGlobalErrorHandlers();

// Plugin UIs run in sandboxed iframes (see features/plugins/sandbox); the host
// realm no longer exposes React/UI globals or executes plugin renderer code.

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <ApiProvider>
                <ClusterProvider>
                    <PluginProvider>
                        <PluginNotifications />
                        <App />
                    </PluginProvider>
                </ClusterProvider>
            </ApiProvider>
        </ErrorBoundary>
    </React.StrictMode>,
)
