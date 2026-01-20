import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { ApiProvider } from './services/api-context'
import '../styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <ApiProvider>
                <App />
            </ApiProvider>
        </ErrorBoundary>
    </React.StrictMode>,
)
