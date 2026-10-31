import {
  ArrowRightLeft,
  ExternalLink,
  Loader2,
  RefreshCw,
  Square,
  AlertCircle,
} from 'lucide-react';
import { useApi } from '../services/api-context';
import { usePortForwards } from '../features/portforward/usePortForwards';
import type { PortForwardInfo } from '../types';

function formatStarted(startedAt: string): string {
  const date = new Date(startedAt);
  return isNaN(date.getTime()) ? startedAt : date.toLocaleTimeString();
}

export function PortForwards() {
  const api = useApi();
  const { forwards, loading, error, refetch, stopForward } = usePortForwards();

  const handleOpen = (forward: PortForwardInfo) => {
    // Fire-and-forget: the main process logs a failure to open the browser.
    void api.openExternal(`http://localhost:${forward.localPort}`);
  };

  return (
    <div className="port-forwards-page">
      <div className="port-forwards-page__header">
        <div className="port-forwards-page__title">
          <ArrowRightLeft size={18} color="var(--color-primary)" />
          <span className="port-forwards-page__title-text">Port Forwards</span>
          {forwards.length > 0 && (
            <span className="port-forwards-page__count-badge">
              {forwards.length} active
            </span>
          )}
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="port-forwards-page__refresh-btn"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="port-forwards-page__body">
        {loading && forwards.length === 0 && (
          <div className="port-forwards-page__status">
            <Loader2 size={20} className="animate-spin" />
            <span>Loading port forwards...</span>
          </div>
        )}

        {error && !loading && (
          <div className="port-forwards-page__error">
            <AlertCircle size={32} />
            <p style={{ margin: 0 }}>{error}</p>
            <button onClick={refetch} className="port-forwards-page__retry-btn">
              Retry
            </button>
          </div>
        )}

        {!error && !loading && forwards.length === 0 && (
          <div className="port-forwards-page__empty">
            <ArrowRightLeft
              size={48}
              className="port-forwards-page__empty-icon"
            />
            <p className="port-forwards-page__empty-title">
              No active port forwards
            </p>
            <p className="port-forwards-page__empty-subtitle">
              Use the Forward action on a Pod or Service in Cluster Details to
              open a tunnel.
            </p>
          </div>
        )}

        {forwards.length > 0 && (
          <table className="port-forwards-page__table">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Namespace</th>
                <th>Context</th>
                <th>Tunnel</th>
                <th>Started</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {forwards.map((fwd) => (
                <tr key={fwd.id} className="port-forwards-page__row">
                  <td className="port-forwards-page__cell--mono">
                    {fwd.resourceType}/{fwd.resourceName}
                  </td>
                  <td>{fwd.namespace}</td>
                  <td>{fwd.contextName}</td>
                  <td className="port-forwards-page__cell--mono">
                    localhost:{fwd.localPort} → {fwd.remotePort}
                  </td>
                  <td>{formatStarted(fwd.startedAt)}</td>
                  <td className="port-forwards-page__actions">
                    <button
                      onClick={() => handleOpen(fwd)}
                      className="port-forwards-page__action-btn"
                      title={`Open http://localhost:${fwd.localPort}`}
                    >
                      <ExternalLink size={14} />
                    </button>
                    <button
                      onClick={() => stopForward(fwd)}
                      className="port-forwards-page__action-btn port-forwards-page__action-btn--stop"
                      title="Stop forward"
                    >
                      <Square size={14} />
                      Stop
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
