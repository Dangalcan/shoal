/**
 * Plugin Runtime
 * 
 * Simulates the loading of plugin UI components based on enabled plugins.
 * In a real app, this would dynamically load JS bundles.
 */

import { useEffect } from 'react';
import { usePlugins } from './PluginProvider';
import { pluginUIRegistry } from '../../services/plugin-ui-registry';
import { Activity, FileText, Globe } from 'lucide-react';
import '../../../styles/components/plugins/PluginRuntime.css';
import { toast } from 'sonner';

import { useState } from 'react';

// Mock Widget Components
const ClusterStatsWidget = () => {
  const { executePluginAction } = usePlugins();
  const [data, setData] = useState({ cpu: 0, memory: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        const result = await executePluginAction('stats-pro', 'getStats');
        if (active) {
            setData(result);
            setLoading(false);
        }
      } catch (err) {
        console.error('Widget IPC failed:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [executePluginAction]);

  if (loading) return <div className="widget-content">Loading stats...</div>;

  return (
    <div className="widget-content widget-stats">
      <div className="stat-item">
        <span className="stat-label">CPU Usage</span>
        <div className="stat-bar"><div className="stat-fill" style={{ width: `${data.cpu}%` }}></div></div>
        <span className="stat-value">{data.cpu}%</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Memory</span>
        <div className="stat-bar"><div className="stat-fill" style={{ width: `${data.memory}%` }}></div></div>
        <span className="stat-value">{data.memory}%</span>
      </div>
    </div>
  );
};

const RecentLogsWidget = () => {
  const { executePluginAction } = usePlugins();
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const result = await executePluginAction('log-viewer-plus', 'getLogs');
        setLogs(result);
      } catch (err) {
        console.error('Logs IPC failed:', err);
      }
    };
    fetchLogs();
  }, [executePluginAction]);

  return (
    <div className="widget-content widget-logs">
      {logs.map((log, i) => (
        <div key={i} className="log-entry info">
          <span className="log-time">{log.time.split('T')[1].split('.')[0]}</span>
          <span className="log-msg">{log.msg}</span>
        </div>
      ))}
      {logs.length === 0 && <p className="text-slate-500 text-xs text-center">No logs retrieved yet.</p>}
    </div>
  );
};

const SecurityScanWidget = () => (
  <div className="widget-content widget-security">
    <div className="security-score safe">A+</div>
    <p>No vulnerabilities found.</p>
    <small>Last scan: 2 hours ago</small>
  </div>
);

// Mock Page Components
const ClusterStatsPage = () => (
  <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
    <h2 className="text-xl mb-4 font-semibold">Cluster Resource Monitoring</h2>
    <div className="grid grid-cols-2 gap-6">
      <div className="p-4 bg-slate-800 rounded-lg">
        <h3 className="text-sm font-medium text-slate-400 mb-2">CPU LOAD</h3>
        <p className="text-4xl font-bold">45.2%</p>
      </div>
      <div className="p-4 bg-slate-800 rounded-lg">
        <h3 className="text-sm font-medium text-slate-400 mb-2">MEMORY USAGE</h3>
        <p className="text-4xl font-bold">8.4 GB</p>
      </div>
    </div>
    <div className="mt-8 h-64 flex items-end justify-between gap-2">
      {Array.from({ length: 20 }).map((_, i) => (
        <div 
          key={i} 
          className="bg-primary-500 w-full" 
          style={{ height: `${Math.random() * 80 + 20}%`, opacity: 0.3 + (i / 30) }}
        ></div>
      ))}
    </div>
    <p className="mt-4 text-center text-slate-500 italic">This is a mock UI contributed by the Stats Pro plugin.</p>
  </div>
);

const LogViewerPage = () => (
  <div className="flex flex-col h-full bg-black rounded-lg border border-slate-800 overflow-hidden">
    <div className="bg-slate-900 p-2 border-bottom border-slate-800 flex justify-between">
      <div className="flex gap-2">
        <div className="w-3 h-3 rounded-full bg-red-500"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
      </div>
      <span className="text-xs font-mono text-slate-500">log-viewer-plus output</span>
    </div>
    <div className="flex-1 p-4 font-mono text-sm overflow-y-auto">
      <p className="text-blue-400">INFO [2026-02-01 10:45:01] Starting application...</p>
      <p className="text-slate-400">DEBUG [2026-02-01 10:45:02] Loading configuration from /etc/app/config.json</p>
      <p className="text-blue-400">INFO [2026-02-01 10:45:03] Database connection established: postgres://localhost:5432</p>
      <p className="text-yellow-400">WARN [2026-02-01 10:45:05] Memory usage exceeds 70%</p>
      <p className="text-red-400">ERROR [2026-02-01 10:45:10] Request failed: Timeout after 5000ms</p>
      <p className="text-slate-400 text-opacity-50">...</p>
      {Array.from({ length: 50 }).map((_, i) => (
        <p key={i} className="text-slate-500 text-xs">Line {i + 1}: Dummy output data for scroll verification.</p>
      ))}
    </div>
  </div>
);

export function PluginRuntime() {
  const { plugins } = usePlugins();

  // Handle Notifications
  useEffect(() => {
    if (window.electron.onPluginNotification) {
      const cleanup = window.electron.onPluginNotification((data: any) => {
        const { message, type, pluginId } = data;
        const plugin = plugins.find(p => p.manifest.id === pluginId);
        const name = plugin ? plugin.manifest.name : pluginId;
        
        switch (type) {
          case 'success': toast.success(message, { description: `From: ${name}` }); break;
          case 'error': toast.error(message, { description: `From: ${name}` }); break;
          case 'warning': toast.warning(message, { description: `From: ${name}` }); break;
          default: toast.info(message, { description: `From: ${name}` });
        }
      });
      return () => {
        // Preload-emitted IPC listeners often don't have cleanup in simple setups, 
        // but we assume it might be returning a cleanup fn if implemented properly.
        // In our current preload.ts it doesn't return anything yet.
      };
    }
  }, [plugins]);

  useEffect(() => {
    // Sync plugins to registry
    
    // 1. Cluster Stats Pro
    if (plugins.find(p => p.manifest.id === 'stats-pro' && p.state === 'enabled')) {
      pluginUIRegistry.registerWidget({
        id: 'stats-pro.cpu-mem',
        title: 'Cluster Resources',
        size: 'medium',
        component: ClusterStatsWidget
      });
      pluginUIRegistry.registerPage({
        id: 'stats-pro',
        component: ClusterStatsPage
      });
    } else {
      pluginUIRegistry.unregisterWidget('stats-pro.cpu-mem');
      pluginUIRegistry.unregisterPage('stats-pro');
    }

    // 2. Log Viewer Plus
    if (plugins.find(p => p.manifest.id === 'log-viewer-plus' && p.state === 'enabled')) {
      pluginUIRegistry.registerWidget({
        id: 'log-viewer.recent',
        title: 'Recent Activity',
        size: 'large',
        component: RecentLogsWidget
      });
      pluginUIRegistry.registerPage({
        id: 'log-viewer-plus',
        component: LogViewerPage
      });
      pluginUIRegistry.registerResourceAction({
        id: 'log-viewer-plus.view-logs',
        label: 'View Enhanced Logs',
        resourceTypes: ['pod'],
        onClick: (resource) => {
          toast.info(`Opening enhanced logs for ${resource.metadata.name}`);
          // In a real app, this would navigate to the plugin page with resource context
        }
      });
    } else {
      pluginUIRegistry.unregisterWidget('log-viewer.recent');
      pluginUIRegistry.unregisterPage('log-viewer-plus');
      pluginUIRegistry.unregisterResourceAction('log-viewer-plus.view-logs');
    }

    // 3. Security Scanner
    if (plugins.find(p => p.manifest.id === 'security-scanner' && p.state === 'enabled')) {
      pluginUIRegistry.registerWidget({
        id: 'security.status',
        title: 'Security Status',
        size: 'small',
        component: SecurityScanWidget
      });
    } else {
      pluginUIRegistry.unregisterWidget('security.status');
    }

  }, [plugins]);

  return null; // This component handles side effects only
}
