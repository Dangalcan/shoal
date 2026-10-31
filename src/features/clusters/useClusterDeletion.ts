import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClusterContext } from './ClusterContext';

/** State and handlers of the "delete this cluster" confirmation. */
export interface ClusterDeletion {
  isOpen: boolean;
  deleting: boolean;
  open: () => void;
  close: () => void;
  confirm: () => Promise<void>;
}

/** Deleting the cluster shown by the details page, then leaving it. */
export function useClusterDeletion(name: string | undefined): ClusterDeletion {
  const navigate = useNavigate();
  const { deleteCluster, deleting } = useClusterContext();
  const [isOpen, setIsOpen] = useState(false);

  const confirm = async () => {
    if (!name) return;
    const { success } = await deleteCluster(name);
    if (success) {
      navigate('/clusters');
    }
    setIsOpen(false);
  };

  return {
    isOpen,
    deleting: !!deleting,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    confirm,
  };
}
