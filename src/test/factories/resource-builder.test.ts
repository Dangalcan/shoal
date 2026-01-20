import { describe, it, expect } from 'vitest';
import { PodBuilder, DeploymentBuilder, NodeBuilder } from './resource-builder';

describe('Resource Builders', () => {
  describe('PodBuilder', () => {
    it('should create a pod with default values', () => {
      const pod = new PodBuilder().build();
      expect(pod.metadata.name).toBeDefined();
      expect(pod.status!.phase).toBe('Running');
    });

    it('should override name and namespace', () => {
      const pod = new PodBuilder()
        .withName('custom-pod')
        .withNamespace('kube-system')
        .build();

      expect(pod.metadata.name).toBe('custom-pod');
      expect(pod.metadata.namespace).toBe('kube-system');
    });

    it('should update status phase', () => {
      const pod = new PodBuilder().withPhase('Succeeded').build();

      expect(pod.status!.phase).toBe('Succeeded');
    });

    it('should add containers and statuses', () => {
      const pod = new PodBuilder()
        .withContainer('web', 'nginx:latest', true)
        .build();

      expect(pod.spec!.containers).toContainEqual({
        name: 'web',
        image: 'nginx:latest',
      });
      expect(pod.status!.containerStatuses).toContainEqual(
        expect.objectContaining({
          name: 'web',
          image: 'nginx:latest',
          ready: true,
        })
      );
    });
  });

  describe('DeploymentBuilder', () => {
    it('should override replicas', () => {
      const deploy = new DeploymentBuilder()
        .withName('web-deploy')
        .withReplicas(3)
        .withAvailableReplicas(2)
        .build();

      expect(deploy.metadata.name).toBe('web-deploy');
      expect(deploy.spec!.replicas).toBe(3);
      expect(deploy.status!.availableReplicas).toBe(2);
    });
  });

  describe('NodeBuilder', () => {
    it('should set roles and conditions', () => {
      const node = new NodeBuilder()
        .withName('worker-1')
        .withRole('worker')
        .withStatus('Ready', 'True')
        .build();

      expect(node.metadata.name).toBe('worker-1');
      expect(node.metadata.labels?.['kubernetes.io/role/worker']).toBe('');
      expect(
        node.status!.conditions.find((c) => c.type === 'Ready')!.status
      ).toBe('True');
    });
  });
});
