import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import './Layout.css'

export function Layout() {
    return (
        <div className="layout-container">
            <Sidebar />
            <main className="layout-main">
                <Outlet />
            </main>
        </div>
    )
}
