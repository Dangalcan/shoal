import { useState } from 'react';
import type { K8sResource } from '../types/k8s-types';

interface ModalStateResult {
  selectedItem: K8sResource | null;
  showDescribe: boolean;
  showYaml: boolean;
  showLogs: boolean;
  showDelete: boolean;
  openDescribe: (item: K8sResource) => void;
  openYaml: (item: K8sResource) => void;
  openLogs: (item: K8sResource) => void;
  openDelete: (item: K8sResource) => void;
  closeAll: () => void;
}

export function useModalState(): ModalStateResult {
  const [selectedItem, setSelectedItem] = useState<K8sResource | null>(null);
  const [showDescribe, setShowDescribe] = useState(false);
  const [showYaml, setShowYaml] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const openDescribe = (item: K8sResource) => {
    setSelectedItem(item);
    setShowDescribe(true);
  };

  const openYaml = (item: K8sResource) => {
    setSelectedItem(item);
    setShowYaml(true);
  };

  const openLogs = (item: K8sResource) => {
    setSelectedItem(item);
    setShowLogs(true);
  };

  const openDelete = (item: K8sResource) => {
    setSelectedItem(item);
    setShowDelete(true);
  };

  const closeAll = () => {
    setSelectedItem(null);
    setShowDescribe(false);
    setShowYaml(false);
    setShowLogs(false);
    setShowDelete(false);
  };

  return {
    selectedItem,
    showDescribe,
    showYaml,
    showLogs,
    showDelete,
    openDescribe,
    openYaml,
    openLogs,
    openDelete,
    closeAll,
  };
}
