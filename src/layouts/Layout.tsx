import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'

export function Layout() {
    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            <Sidebar />
            <main className="flex-1 overflow-auto relative">
                <Outlet />
            </main>
        </div>
    )
}
