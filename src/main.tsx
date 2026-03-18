import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { ApiProvider } from './services/api-context'
import { ClusterProvider } from './features/clusters/ClusterContext'
import '../styles/tailwind.css'
import '../styles/index.scss'
import { PluginProvider } from './features/plugins/PluginProvider';
import { PluginRuntime } from './features/plugins/PluginRuntime';
import * as UI from './components/ui';
import * as LucideIcons from 'lucide-react';

// Expose React and other common libs for plugins
window.React = React;
window.K8sUI = UI as Record<string, unknown>;
window.LucideIcons = LucideIcons as Record<string, unknown>;

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
