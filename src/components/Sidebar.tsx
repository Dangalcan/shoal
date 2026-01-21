import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Server, Settings, Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '../lib/utils'
import { useTheme } from '../hooks'
import '../../styles/components/Sidebar.css'

export function Sidebar() {
    const { theme, toggleTheme } = useTheme();
    const [version, setVersion] = useState<string>('v0.1.0');

    useEffect(() => {
        const fetchVersion = async () => {
            const result = await window.electron.getAppVersion();
            if (result.success && result.data) {
                setVersion(result.data);
            }
        };
        fetchVersion();
    }, []);

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
                <button 
                  className="theme-toggle" 
                  onClick={toggleTheme}
                  title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                  {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                  <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                </button>
                <div className="sidebar-version">{version}</div>
            </div>
        </aside>
    )
}
