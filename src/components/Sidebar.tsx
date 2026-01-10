import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Server, Settings } from 'lucide-react'
import { cn } from '../lib/utils'
import '../../styles/components/Sidebar.css'

export function Sidebar() {
    const links = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/clusters', icon: Server, label: 'Clusters' },
        { to: '/settings', icon: Settings, label: 'Settings' },
    ]

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h1 className="sidebar-title">
                    <Server size={24} />
                    <span>K8s Desktop</span>
                </h1>
            </div>
            <nav className="sidebar-nav">
                {links.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            cn(
                                "sidebar-link",
                                isActive
                                    ? "sidebar-link-active"
                                    : "sidebar-link-inactive"
                            )
                        }
                    >
                        <Icon size={18} />
                        {label}
                    </NavLink>
                ))}
            </nav>
            <div className="sidebar-footer">
                <div className="sidebar-version">v0.1.0</div>
            </div>
        </aside>
    )
}
