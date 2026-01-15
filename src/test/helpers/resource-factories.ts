import type { Pod, Deployment, Node } from '../../types/k8s-types';
import { mockPod, mockDeployment, mockNode } from '../fixtures/k8s-resources';

/**
 * Creates a mock Pod with optional overrides.
 */
export const createMockPod = (overrides: Partial<Pod> = {}): Pod => {
  return {
    ...mockPod,
    metadata: {
      ...mockPod.metadata,
      ...(overrides.metadata || {}),
    },
    status: {
      ...mockPod.status,
      ...(overrides.status || {}),
    } as any,
    spec: {
      ...mockPod.spec,
      ...(overrides.spec || {}),
    } as any,
  };
};

/**
 * Creates a mock Deployment with optional overrides.
 */
export const createMockDeployment = (
  overrides: Partial<Deployment> = {}
): Deployment => {
  return {
    ...mockDeployment,
    metadata: {
      ...mockDeployment.metadata,
      ...(overrides.metadata || {}),
    },
    status: {
      ...mockDeployment.status,
      ...(overrides.status || {}),
    } as any,
    spec: {
      ...mockDeployment.spec,
      ...(overrides.spec || {}),
    } as any,
  };
};

/**
 * Creates a mock Node with optional overrides.
 */
export const createMockNode = (overrides: Partial<Node> = {}): Node => {
  return {
    ...mockNode,
    metadata: {
      ...mockNode.metadata,
      ...(overrides.metadata || {}),
    },
    status: {
      ...mockNode.status,
      ...(overrides.status || {}),
    } as any,
  };
};
