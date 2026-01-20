import type { Pod, Deployment, Node, K8sResource } from '../../types/k8s-types';
import { mockPod, mockDeployment, mockNode } from '../fixtures/k8s-resources';

/**
 * Base builder class for Kubernetes resources.
 */
export class ResourceBuilder<T extends K8sResource> {
  protected resource: T;

  constructor(initialState: T) {
    this.resource = JSON.parse(JSON.stringify(initialState)); // Deep copy
  }

  withName(name: string): this {
    this.resource.metadata.name = name;
    return this;
  }

  withNamespace(namespace: string): this {
    this.resource.metadata.namespace = namespace;
    return this;
  }

  withLabel(key: string, value: string): this {
    if (!this.resource.metadata.labels) {
      this.resource.metadata.labels = {};
    }
    this.resource.metadata.labels[key] = value;
    return this;
  }

  withAnnotation(key: string, value: string): this {
    if (!this.resource.metadata.annotations) {
      this.resource.metadata.annotations = {};
    }
    this.resource.metadata.annotations[key] = value;
    return this;
  }

  withCreationTimestamp(timestamp: string): this {
    this.resource.metadata.creationTimestamp = timestamp;
    return this;
  }

  build(): T {
    return this.resource;
  }
}

/**
 * Builder for Pod resources.
 */
export class PodBuilder extends ResourceBuilder<Pod> {
  constructor(initialState: Pod = mockPod) {
    super(initialState);
  }

  withPhase(phase: Pod['status']['phase']): this {
    this.resource.status.phase = phase;
    return this;
  }

  withStatus(status: Partial<Pod['status']>): this {
    this.resource.status = { ...this.resource.status, ...status };
    return this;
  }

  withContainer(name: string, image: string, ready: boolean = true): this {
    if (!this.resource.spec.containers) {
      this.resource.spec.containers = [];
    }

    // Update spec
    const existingSpecIdx = this.resource.spec.containers.findIndex(
      (c) => c.name === name
    );
    if (existingSpecIdx >= 0) {
      this.resource.spec.containers[existingSpecIdx] = { name, image };
    } else {
      this.resource.spec.containers.push({ name, image });
    }

    // Update status
    if (!this.resource.status.containerStatuses) {
      this.resource.status.containerStatuses = [];
    }

    const existingStatusIdx = this.resource.status.containerStatuses.findIndex(
      (c) => c.name === name
    );
    if (existingStatusIdx >= 0) {
      this.resource.status.containerStatuses[existingStatusIdx] = {
        ...this.resource.status.containerStatuses[existingStatusIdx],
        image,
        ready,
      };
    } else {
      this.resource.status.containerStatuses.push({
        name,
        image,
        ready,
        restartCount: 0,
      });
    }

    return this;
  }

  withNode(nodeName: string): this {
    this.resource.spec.nodeName = nodeName;
    return this;
  }
}

/**
 * Builder for Deployment resources.
 */
export class DeploymentBuilder extends ResourceBuilder<Deployment> {
  constructor(initialState: Deployment = mockDeployment) {
    super(initialState);
  }

  withReplicas(replicas: number): this {
    this.resource.spec.replicas = replicas;
    return this;
  }

  withAvailableReplicas(available: number): this {
    this.resource.status.availableReplicas = available;
    return this;
  }

  withReadyReplicas(ready: number): this {
    this.resource.status.readyReplicas = ready;
    return this;
  }

  withConditions(conditions: Deployment['status']['conditions']): this {
    this.resource.status.conditions = conditions;
    return this;
  }
}

/**
 * Builder for Node resources.
 */
export class NodeBuilder extends ResourceBuilder<Node> {
  constructor(initialState: Node = mockNode) {
    super(initialState);
  }

  withStatus(
    conditionType: string,
    status: 'True' | 'False' | 'Unknown'
  ): this {
    if (!this.resource.status.conditions) {
      this.resource.status.conditions = [];
    }

    const idx = this.resource.status.conditions.findIndex(
      (c) => c.type === conditionType
    );
    if (idx >= 0) {
      this.resource.status.conditions[idx].status = status;
    } else {
      this.resource.status.conditions.push({
        type: conditionType,
        status,
        lastHeartbeatTime: new Date().toISOString(),
        lastTransitionTime: new Date().toISOString(),
        reason: 'MockReason',
        message: 'MockMessage',
      });
    }
    return this;
  }

  withRole(role: string): this {
    return this.withLabel(`kubernetes.io/role/${role}`, '');
  }
}
