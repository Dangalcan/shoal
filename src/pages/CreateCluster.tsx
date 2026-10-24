import { useId, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, ArrowLeft } from 'lucide-react';
import { handleAsyncOperation } from '../lib/async-operation-handler';
import { useApi } from '../services/api-context';
import { useClusterContext } from '../features/clusters/ClusterContext';
import { ToolMissingPanel } from '../components/common/ToolMissingPanel';
import { useToolStatus, TOOL_INSTALL_URLS } from '../hooks/useToolStatus';

export function CreateCluster() {
  const navigate = useNavigate();
  const api = useApi();
  const { fetchClusters } = useClusterContext();
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('kind');
  const nameInputId = useId();

  const [isCreating, setIsCreating] = useState(false);

  // kind and k3d need their own CLI plus a running Docker engine.
  const providerTool = useToolStatus(provider);
  const docker = useToolStatus('docker');
  const dockerUnavailable =
    !docker.checking &&
    docker.status !== null &&
    !(docker.status.installed && docker.status.running);
  const openInstallDocs = (tool: string) => {
    const url = TOOL_INSTALL_URLS[tool];
    if (url) void api.openExternal(url);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setIsCreating(true);
    // One toast that turns green or red with the result. toast.promise used
    // to report success for a resolved-but-failed Result, so a green and a
    // red toast appeared together.
    const result = await handleAsyncOperation(
      () => api.createCluster(name, provider),
      {
        loadingMessage: `Creating cluster "${name}"...`,
        successMessage: `Cluster "${name}" created.`,
        errorTitle: 'Cluster creation failed',
      }
    );
    setIsCreating(false);
    if (result.success) {
      setName('');
      await fetchClusters();
      await navigate('/clusters');
    }
  };

  return (
    <div className="create-cluster-container">
      <header className="create-cluster-header">
        <button
          type="button"
          className="back-button"
          onClick={() => navigate('/clusters')}
        >
          <ArrowLeft size={20} />
          <span>Back to Clusters</span>
        </button>
        <h2 className="create-cluster-title">Create Cluster</h2>
        <p className="create-cluster-subtitle">
          Configure your new Kubernetes cluster.
        </p>
      </header>

      <form onSubmit={handleCreate} className="create-cluster-form">
        <div>
          <label className="form-group-label" htmlFor={nameInputId}>
            Cluster Name
          </label>
          <input
            id={nameInputId}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input"
            placeholder="my-cluster"
            required
          />
        </div>

        <div>
          <label className="form-group-label">Provider</label>
          <div className="provider-grid">
            {['kind', 'k3d'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                className={`provider-button ${provider === p ? 'provider-button-selected' : 'provider-button-unselected'}`}
              >
                <Server size={20} />
                <span className="provider-button-label">{p}</span>
              </button>
            ))}
          </div>
        </div>

        {providerTool.missing && (
          <ToolMissingPanel
            compact
            title={`${provider} not found`}
            description={
              <p>
                Creating a {provider} cluster needs the <code>{provider}</code>{' '}
                CLI on your PATH.
              </p>
            }
            onOpenInstallDocs={() => openInstallDocs(provider)}
            onRecheck={providerTool.recheck}
          />
        )}

        {dockerUnavailable && (
          <ToolMissingPanel
            compact
            title={
              docker.status?.installed
                ? 'Docker is not running'
                : 'Docker not found'
            }
            description={
              <p>
                {provider} runs the cluster nodes as Docker containers.{' '}
                {docker.status?.installed
                  ? 'Start Docker Desktop (or the Docker service) and check again.'
                  : 'Install Docker and make sure it is running.'}
              </p>
            }
            onOpenInstallDocs={() => openInstallDocs('docker')}
            onRecheck={docker.recheck}
          />
        )}

        <div className="form-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={() => navigate('/clusters')}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="submit-button"
            disabled={isCreating || providerTool.missing}
            title={
              providerTool.missing ? `Install ${provider} first` : undefined
            }
          >
            {isCreating ? 'Creating...' : 'Create Cluster'}
          </button>
        </div>
      </form>
    </div>
  );
}
