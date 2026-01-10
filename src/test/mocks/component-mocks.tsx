import { vi } from 'vitest';
import React from 'react';

/**
 * Common component mocks to be used across the test suite.
 * This prevents redundancy and ensures consistent behavior in integration tests.
 */

export const mockModalProps = {
  LogViewerModal: ({ isOpen, onClose, podName }: any) => 
    isOpen ? <div data-testid="log-modal">Logs for {podName} <button onClick={onClose}>Close</button></div> : null,
  
  DescribeModal: ({ isOpen, onClose, resourceName }: any) => 
    isOpen ? <div data-testid="describe-modal">Describe {resourceName} <button onClick={onClose}>Close</button></div> : null,
  
  YamlModal: ({ isOpen, onClose, resourceName }: any) => 
    isOpen ? <div data-testid="yaml-modal">YAML {resourceName} <button onClick={onClose}>Close</button></div> : null
};

// Register component mocks with vitest
vi.mock('../../components/modals/LogViewerModal', () => ({
  LogViewerModal: mockModalProps.LogViewerModal
}));

vi.mock('../../components/modals/DescribeModal', () => ({
  DescribeModal: mockModalProps.DescribeModal
}));

vi.mock('../../components/modals/YamlModal', () => ({
  YamlModal: mockModalProps.YamlModal
}));
