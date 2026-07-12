import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '../ui/Button';
import { BaseModal } from './BaseModal';

interface ScaleResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScale: (replicas: number) => void;
  resourceType: string;
  resourceName: string;
  /** Replicas currently declared in the resource spec. */
  currentReplicas: number;
}

const SLIDER_MAX = 20;
const INPUT_MAX = 1000;

export function ScaleResourceModal({
  isOpen,
  onClose,
  onScale,
  resourceType,
  resourceName,
  currentReplicas,
}: ScaleResourceModalProps) {
  const [replicas, setReplicas] = useState(currentReplicas);

  // Reset to the resource's declared count each time the modal opens
  // (render-phase state adjustment; not an effect, so no extra render flash).
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setReplicas(currentReplicas);
  }

  const isValid = Number.isInteger(replicas) && replicas >= 0 && replicas <= INPUT_MAX;
  const unchanged = replicas === currentReplicas;

  const handleInputChange = (value: string) => {
    const parsed = Number(value);
    setReplicas(Number.isNaN(parsed) ? 0 : Math.trunc(parsed));
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Scale ${resourceType}`}
      icon={<SlidersHorizontal size={20} />}
      maxWidth="440px"
      footer={
        <>
          <button className="close-footer-button" onClick={onClose}>
            Cancel
          </button>
          <Button
            variant="primary"
            onClick={() => {
              onScale(replicas);
              onClose();
            }}
            disabled={!isValid || unchanged}
          >
            Scale to {isValid ? replicas : '—'}
          </Button>
        </>
      }
    >
      <div className="scale-modal">
        <p className="scale-modal__resource">
          {resourceType}/<strong>{resourceName}</strong>
        </p>
        <p className="scale-modal__current">
          Current replicas: <strong>{currentReplicas}</strong>
        </p>
        {replicas === 0 && (
          <p className="scale-modal__warning">
            Scaling to 0 stops all pods of this workload.
          </p>
        )}
        <div className="scale-modal__controls">
          <input
            type="range"
            className="scale-modal__slider"
            min={0}
            max={SLIDER_MAX}
            value={Math.min(replicas, SLIDER_MAX)}
            onChange={(e) => setReplicas(Number(e.target.value))}
            aria-label="Replica count slider"
          />
          <input
            type="number"
            className="scale-modal__input"
            min={0}
            max={INPUT_MAX}
            value={replicas}
            onChange={(e) => handleInputChange(e.target.value)}
            aria-label="Replica count"
          />
        </div>
      </div>
    </BaseModal>
  );
}
