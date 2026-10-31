import { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { BaseModal } from './BaseModal';
import { useApi } from '../../services/api-context';
import { startPortForwardOperation } from '../../features/portforward/usePortForwards';

interface PortForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextName: string;
  namespace: string;
  resourceType: 'pod' | 'service';
  resourceName: string;
  /** Ports declared on the resource, used as remote-port suggestions. */
  suggestedPorts?: number[];
}

export function PortForwardModal(props: PortForwardModalProps) {
  // The form exists only while the modal is open and is keyed on the
  // resource, so every opening (and a resource change while open) starts
  // from the suggested port with nothing touched.
  if (!props.isOpen) return null;
  return <PortForwardForm key={props.resourceName} {...props} />;
}

function PortForwardForm({
  onClose,
  contextName,
  namespace,
  resourceType,
  resourceName,
  suggestedPorts = [],
}: PortForwardModalProps) {
  const api = useApi();
  const initialPort = suggestedPorts[0] ? String(suggestedPorts[0]) : '';
  const [remotePort, setRemotePort] = useState(initialPort);
  const [localPort, setLocalPort] = useState(initialPort);
  const [localTouched, setLocalTouched] = useState(false);
  const [starting, setStarting] = useState(false);

  const handleRemoteChange = (value: string) => {
    setRemotePort(value);
    if (!localTouched) setLocalPort(value);
  };

  const local = Number(localPort);
  const remote = Number(remotePort);
  const isValidPort = (p: number) =>
    Number.isInteger(p) && p >= 1 && p <= 65535;
  const canStart = isValidPort(local) && isValidPort(remote) && !starting;

  const handleStart = async () => {
    if (!canStart) return;
    setStarting(true);
    const result = await startPortForwardOperation(api.portForwardStart, {
      contextName,
      namespace,
      resourceType,
      resourceName,
      localPort: local,
      remotePort: remote,
    });
    setStarting(false);
    if (result.success) onClose();
  };

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title={`Forward ${resourceType}/${resourceName}`}
      subtitle={`namespace: ${namespace}  |  context: ${contextName}`}
      icon={<ArrowRightLeft size={18} />}
      maxWidth="440px"
      footer={
        <div className="port-forward-modal__footer">
          <button onClick={onClose} className="port-forward-modal__cancel-btn">
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="port-forward-modal__start-btn"
          >
            {starting ? 'Starting...' : 'Start Forward'}
          </button>
        </div>
      }
    >
      <div className="port-forward-modal__body">
        <label className="port-forward-modal__field">
          <span className="port-forward-modal__label">
            Remote port ({resourceType})
          </span>
          <input
            type="number"
            min={1}
            max={65535}
            value={remotePort}
            onChange={(e) => handleRemoteChange(e.target.value)}
            placeholder="e.g. 80"
            className="port-forward-modal__input"
          />
          {suggestedPorts.length > 0 && (
            <div className="port-forward-modal__suggestions">
              {suggestedPorts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleRemoteChange(String(p))}
                  className="port-forward-modal__suggestion"
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </label>

        <label className="port-forward-modal__field">
          <span className="port-forward-modal__label">Local port</span>
          <input
            type="number"
            min={1}
            max={65535}
            value={localPort}
            onChange={(e) => {
              setLocalTouched(true);
              setLocalPort(e.target.value);
            }}
            placeholder="e.g. 8080"
            className="port-forward-modal__input"
          />
        </label>

        <p className="port-forward-modal__hint">
          Traffic to <code>localhost:{localPort || '…'}</code> will be tunneled
          to <code>{`${resourceType}/${resourceName}`}</code> port{' '}
          <code>{remotePort || '…'}</code>. Manage active tunnels in the Port
          Forwards page.
        </p>
      </div>
    </BaseModal>
  );
}
