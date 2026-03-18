import { useState } from 'react';
import type { K8sResource } from '../types/k8s-types';

type ModalType = 'describe' | 'yaml' | 'logs' | 'delete';

interface ModalStateResult {
  selectedItem: K8sResource | null;
  activeModal: ModalType | null;
  openDescribe: (item: K8sResource) => void;
  openYaml: (item: K8sResource) => void;
  openLogs: (item: K8sResource) => void;
  openDelete: (item: K8sResource) => void;
  closeAll: () => void;
}

export function useModalState(): ModalStateResult {
  const [selectedItem, setSelectedItem] = useState<K8sResource | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);

  const open = (type: ModalType) => (item: K8sResource) => {
    setSelectedItem(item);
    setActiveModal(type);
  };

  const closeAll = () => {
    setSelectedItem(null);
    setActiveModal(null);
  };

  return {
    selectedItem,
    activeModal,
    openDescribe: open('describe'),
    openYaml: open('yaml'),
    openLogs: open('logs'),
    openDelete: open('delete'),
    closeAll,
  };
}
