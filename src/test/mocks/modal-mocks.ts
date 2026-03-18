/**
 * modal-mocks.ts
 *
 * Opt-in modal mocks for page/integration tests.
 * Import this file in tests that render pages containing modals but don't
 * need to test the modal internals. Modal unit tests should NOT import this.
 */
import { vi } from 'vitest';
import React from 'react';

vi.mock('../../components/modals/LogViewerModal', () => ({
  LogViewerModal: ({ isOpen, onClose, podName }: any) =>
    isOpen
      ? React.createElement(
          'div',
          { 'data-testid': 'log-modal' },
          `Logs for ${podName} `,
          React.createElement('button', { onClick: onClose }, 'Close')
        )
      : null,
}));

vi.mock('../../components/modals/DescribeModal', () => ({
  DescribeModal: ({ isOpen, onClose, resourceName }: any) =>
    isOpen
      ? React.createElement(
          'div',
          { 'data-testid': 'describe-modal' },
          `Describe ${resourceName} `,
          React.createElement('button', { onClick: onClose }, 'Close')
        )
      : null,
}));

vi.mock('../../components/modals/YamlModal', () => ({
  YamlModal: ({ isOpen, onClose, resourceName }: any) =>
    isOpen
      ? React.createElement(
          'div',
          { 'data-testid': 'yaml-modal' },
          `YAML ${resourceName} `,
          React.createElement('button', { onClick: onClose }, 'Close')
        )
      : null,
}));

vi.mock('../../components/modals/PodViewerModal', () => ({
  __esModule: true,
  PodViewerModal: ({ isOpen, onClose, clusterName }: any) =>
    isOpen
      ? React.createElement(
          'div',
          { 'data-testid': 'pod-modal' },
          `PodViewer for ${clusterName} `,
          React.createElement('button', { onClick: onClose }, 'Close')
        )
      : null,
}));
