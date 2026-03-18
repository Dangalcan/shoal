import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Server, Settings, Sun, Moon, Package, FileCode } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '../lib/utils'
import { useTheme } from '../hooks'
import { useApi } from '../services/api-context'
import { usePlugins, usePluginExtensions } from '../features/plugins/PluginProvider'
import type { SidebarExtension } from '../../electron/types/plugin-types'
import { ContextSwitcher } from './common/ContextSwitcher'
import { ExternalLink } from 'lucide-react'


export function Sidebar() {
    const api = useApi();
    const { theme, toggleTheme } = useTheme();
    const [version, setVersion] = useState<string>('v0.1.0');
    const { plugins } = usePlugins();
    const allExtensions = usePluginExtensions('sidebar');

    // Only show sidebar entries for plugins that have a renderer (UI page)
    const pluginExtensions = (allExtensions as SidebarExtension[]).filter((ext) => {
        const pluginId = ext.route?.split('/plugin/')?.[1];
        const plugin = plugins.find(p => p.manifest.id === pluginId);
        return plugin?.manifest.renderer != null;
    });

    useEffect(() => {
        const fetchVersion = async () => {
            const result = await api.getAppVersion();
            if (result.success && result.data) {
                setVersion(result.data);
            }
        };
        fetchVersion();
    }, []);

    const links = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/clusters', icon: Server, label: 'Clusters' },
        { to: '/manifests', icon: FileCode, label: 'Manifests' },
        { to: '/plugins', icon: Package, label: 'Plugins' },
        { to: '/settings', icon: Settings, label: 'Settings' },
    ]

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h1 className="sidebar-title">
                    <Server size={24} />
                    <span>K8s Desktop</span>
                </h1>
                <div className="sidebar-context">
                    <ContextSwitcher />
                </div>
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

                {pluginExtensions.length > 0 && (
                  <>
                    <div className="sidebar-divider">Plugins</div>
                    {pluginExtensions.map((ext) => (
                      <NavLink
                          key={ext.id}
                          to={ext.route}
                          className={({ isActive }) =>
                              cn(
                                  "sidebar-link",
                                  isActive
                                      ? "sidebar-link-active"
                                      : "sidebar-link-inactive"
                              )
                          }
                      >
                          <ExternalLink size={18} />
                          {ext.label}
                      </NavLink>
                    ))}
                  </>
                )}
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
