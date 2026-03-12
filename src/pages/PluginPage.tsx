/**
 * Plugin Page Host
 * 
 * Dynamically renders the UI contributed by a plugin for its dedicated page.
 */

import { useParams } from 'react-router-dom';
import { usePluginPage } from '../services/plugin-ui-registry';
import { usePlugins } from '../features/plugins/PluginProvider';
import { AlertTriangle, Home } from 'lucide-react';
import { Button } from '../components/ui';
import { useNavigate } from 'react-router-dom';

export function PluginPage() {
  const { pluginId } = useParams<{ pluginId: string }>();
  const navigate = useNavigate();
  const { plugins, loading } = usePlugins();
  const page = usePluginPage(pluginId || '');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="spinner"></div>
      </div>
    );
  }

  const plugin = plugins.find(p => p.manifest.id === pluginId);
  
  if (!plugin || plugin.state !== 'enabled') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <AlertTriangle size={48} className="text-warning" />
        <h2>Plugin Not Active</h2>
        <p>This plugin is either not installed or disabled.</p>
        <Button onClick={() => navigate('/plugins')}>Manage Plugins</Button>
      </div>
    );
  }

  // Plugin is enabled but script is still loading — wait for it to register a page
  if (!page && plugin.rendererEntry) {
    return (
      <div className="flex items-center justify-center h-full gap-3">
        <div className="spinner" />
        <p>Loading {plugin.manifest.name}...</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <AlertTriangle size={48} className="text-error" />
        <h2>Page Not Found</h2>
        <p>The plugin <strong>{plugin.manifest.name}</strong> is active but didn't register a page UI.</p>
        <Button onClick={() => navigate('/')} variant="secondary">
          <Home size={16} className="mr-2" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  // Render the plugin component
  const PluginContent = page.component;

  return (
    <div className="plugin-page-container h-full p-8 overflow-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-black">{plugin.manifest.name}</h1>
        <p className="text-secondary font-medium">{plugin.manifest.description}</p>
      </header>
      
      <div className="plugin-page-content h-auto">
         <PluginContent />
      </div>
    </div>
  );
}
