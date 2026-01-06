import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Server, Settings } from 'lucide-react'
import { cn } from '../lib/utils'

export function Sidebar() {
    const links = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/clusters', icon: Server, label: 'Clusters' },
        { to: '/settings', icon: Settings, label: 'Settings' },
    ]

    return (
        <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen border-r border-slate-800">
            <div className="p-6">
                <h1 className="text-xl font-bold tracking-tight text-blue-400 flex items-center gap-2">
                    <Server size={24} />
                    <span>K8s Desktop</span>
                </h1>
            </div>
            <nav className="flex-1 px-4 space-y-2 py-4">
                {links.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium",
                                isActive
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                            )
                        }
                    >
                        <Icon size={18} />
                        {label}
                    </NavLink>
                ))}
            </nav>
            <div className="p-4 border-t border-slate-800">
                <div className="text-xs text-slate-500 text-center font-mono">v0.1.0</div>
            </div>
        </aside>
    )
}
