import { describe, it, expect } from 'vitest';
import {
  getJobStatus,
  getNodeStatus,
  getPodStatus,
  getResourceStatus,
  getStatusVariant,
  getVolumeStatus,
} from '../../../lib/resources/resource-status';
import type { ResourceType } from '../../../lib/resources/resource-definitions';
import type { K8sResource, Node, Pod } from '../../../types/k8s-types';
// Real objects from a kind cluster (Kubernetes 1.31), each with what
// `kubectl get` printed for it. A hand-written shape is how this column went
// wrong: the API leaves zero counters out, which no fixture here invented.
import kubectlStatus from '../../fixtures/kubectl-status.json';

const CAPTURED = kubectlStatus as unknown as {
  resourceType: ResourceType;
  expected: string;
  resource: K8sResource;
}[];

const pod = (status: unknown, metadata: object = {}, spec: object = {}): Pod =>
  ({
    metadata: { name: 'p', ...metadata },
    spec: { containers: [], ...spec },
    status,
  }) as unknown as Pod;

const waiting = (reason?: string) => ({ state: { waiting: { reason } } });
const terminated = (fields: object) => ({ state: { terminated: fields } });

describe('getResourceStatus against kubectl', () => {
  it.each(
    CAPTURED.map((row) => [
      row.resourceType,
      row.resource.metadata.name,
      row.expected,
      row.resource,
    ])
  )('%s %s reads %s', (resourceType, _name, expected, resource) => {
    expect(
      getResourceStatus(resource as K8sResource, resourceType as ResourceType)
    ).toBe(expected);
  });

  it('covers the statuses that used to read wrong', () => {
    const printed = CAPTURED.map((row) => row.expected);
    expect(printed).toEqual(
      expect.arrayContaining([
        'CrashLoopBackOff',
        'ImagePullBackOff',
        'Init:CrashLoopBackOff',
        'Terminating',
        'NotReady',
        'Available',
        'Released',
      ])
    );
  });

  it('has no status for a kind without the column', () => {
    expect(
      getResourceStatus({ metadata: {} } as K8sResource, 'deployments')
    ).toBe('Unknown');
  });
});

describe('getPodStatus', () => {
  it('says Unknown for a pod with no status yet', () => {
    expect(getPodStatus(pod(undefined))).toBe('Unknown');
  });

  it('prefers the reason the pod gives over its phase', () => {
    expect(getPodStatus(pod({ phase: 'Failed', reason: 'Evicted' }))).toBe(
      'Evicted'
    );
  });

  it('falls back to the exit code or signal of a terminated container', () => {
    const running = { phase: 'Failed' };
    expect(
      getPodStatus(
        pod({ ...running, containerStatuses: [terminated({ exitCode: 3 })] })
      )
    ).toBe('ExitCode:3');
    expect(
      getPodStatus(
        pod({
          ...running,
          containerStatuses: [terminated({ exitCode: 137, signal: 9 })],
        })
      )
    ).toBe('Signal:9');
    expect(
      getPodStatus(pod({ ...running, containerStatuses: [terminated({})] }))
    ).toBe('ExitCode:0');
  });

  it('prefixes the fallback for an init container', () => {
    expect(
      getPodStatus(
        pod(
          {
            phase: 'Pending',
            initContainerStatuses: [{ state: { terminated: { exitCode: 2 } } }],
          },
          {},
          { initContainers: [{ name: 'init' }] }
        )
      )
    ).toBe('Init:ExitCode:2');
  });

  it('counts the init containers that are done', () => {
    expect(
      getPodStatus(
        pod(
          {
            phase: 'Pending',
            initContainerStatuses: [
              { name: 'a', state: { terminated: { exitCode: 0 } } },
              { name: 'b', ...waiting('PodInitializing') },
            ],
          },
          {},
          { initContainers: [{ name: 'a' }, { name: 'b' }] }
        )
      )
    ).toBe('Init:1/2');
  });

  it('reads the containers again once the pod says it is initialized', () => {
    expect(
      getPodStatus(
        pod(
          {
            phase: 'Running',
            conditions: [{ type: 'Initialized', status: 'True' }],
            initContainerStatuses: [{ name: 'a', ...waiting('Restarting') }],
            containerStatuses: [waiting('CrashLoopBackOff')],
          },
          {},
          { initContainers: [{ name: 'a' }] }
        )
      )
    ).toBe('CrashLoopBackOff');
  });

  it('skips a sidecar only once it has started', () => {
    const initContainers = [{ name: 's', restartPolicy: 'Always' }];
    const running = { state: { running: {} } };
    expect(
      getPodStatus(
        pod(
          {
            phase: 'Pending',
            initContainerStatuses: [{ name: 's', ...running, started: false }],
          },
          {},
          { initContainers }
        )
      )
    ).toBe('Init:0/1');
    expect(
      getPodStatus(
        pod(
          {
            phase: 'Running',
            initContainerStatuses: [{ name: 's', ...running, started: true }],
          },
          {},
          { initContainers }
        )
      )
    ).toBe('Running');
  });

  describe('a Completed container next to others', () => {
    const done = terminated({ exitCode: 0, reason: 'Completed' });
    const up = { ready: true, state: { running: {} } };

    it('is Running while the pod is ready', () => {
      expect(
        getPodStatus(
          pod({
            phase: 'Running',
            conditions: [{ type: 'Ready', status: 'True' }],
            containerStatuses: [done, up],
          })
        )
      ).toBe('Running');
    });

    it('shows the failure of another container', () => {
      expect(
        getPodStatus(
          pod({
            phase: 'Failed',
            containerStatuses: [
              terminated({ exitCode: 1, reason: 'Error' }),
              done,
            ],
          })
        )
      ).toBe('Error');
      expect(
        getPodStatus(
          pod({
            phase: 'Failed',
            containerStatuses: [
              done,
              terminated({ exitCode: 1, reason: 'Error' }),
            ],
          })
        )
      ).toBe('Error');
    });

    it('stays Completed when nothing else runs', () => {
      expect(
        getPodStatus(pod({ phase: 'Succeeded', containerStatuses: [done] }))
      ).toBe('Completed');
    });
  });

  describe('being deleted', () => {
    const deleting = { deletionTimestamp: '2026-11-02T00:00:00Z' };

    it('is Terminating while it runs', () => {
      expect(getPodStatus(pod({ phase: 'Running' }, deleting))).toBe(
        'Terminating'
      );
    });

    it('keeps its final status once finished', () => {
      expect(getPodStatus(pod({ phase: 'Succeeded' }, deleting))).toBe(
        'Succeeded'
      );
      expect(getPodStatus(pod({ phase: 'Failed' }, deleting))).toBe('Failed');
    });

    it('is Unknown when its node was lost', () => {
      expect(
        getPodStatus(pod({ phase: 'Running', reason: 'NodeLost' }, deleting))
      ).toBe('Unknown');
    });
  });
});

describe('getJobStatus', () => {
  const job = (conditions: unknown, metadata: object = {}) =>
    ({ metadata, status: { conditions } }) as never;
  const yes = (type: string) => ({ type, status: 'True' });

  it.each([
    ['Complete', [yes('Complete')]],
    ['Failed', [yes('Failed')]],
    ['Suspended', [yes('Suspended')]],
    ['FailureTarget', [yes('FailureTarget')]],
    ['SuccessCriteriaMet', [yes('SuccessCriteriaMet')]],
    ['Running', undefined],
    ['Running', [{ type: 'Suspended', status: 'False' }]],
  ])('reads %s', (expected, conditions) => {
    expect(getJobStatus(job(conditions))).toBe(expected);
  });

  it('is Terminating while deleted, unless it already finished', () => {
    const deleting = { deletionTimestamp: '2026-11-02T00:00:00Z' };
    expect(getJobStatus(job(undefined, deleting))).toBe('Terminating');
    expect(getJobStatus(job([yes('Complete')], deleting))).toBe('Complete');
  });

  it('does not take a retry for a failure', () => {
    expect(
      getJobStatus({ metadata: {}, status: { failed: 3, active: 1 } } as never)
    ).toBe('Running');
  });
});

describe('getVolumeStatus', () => {
  it('reads the phase, or Terminating while deleted', () => {
    const volume = (phase?: string, deletionTimestamp?: string) =>
      ({ metadata: { deletionTimestamp }, status: { phase } }) as never;
    expect(getVolumeStatus(volume('Bound'))).toBe('Bound');
    expect(getVolumeStatus(volume('Bound', '2026-11-02T00:00:00Z'))).toBe(
      'Terminating'
    );
    expect(getVolumeStatus(volume())).toBe('Unknown');
  });
});

describe('getNodeStatus', () => {
  const node = (ready: string | null, unschedulable?: boolean): Node =>
    ({
      metadata: {},
      spec: { unschedulable },
      status: {
        conditions: ready === null ? [] : [{ type: 'Ready', status: ready }],
      },
    }) as unknown as Node;

  it.each([
    ['Ready', node('True')],
    ['NotReady', node('False')],
    ['NotReady', node('Unknown')],
    ['Unknown', node(null)],
    // As kubectl printed it for a cordoned kind node.
    ['Ready,SchedulingDisabled', node('True', true)],
    ['NotReady,SchedulingDisabled', node('False', true)],
  ])('reads %s', (expected, input) => {
    expect(getNodeStatus(input)).toBe(expected);
  });
});

describe('getStatusVariant', () => {
  it.each([
    ['pods', 'Running', 'success'],
    ['pods', 'Completed', 'success'],
    ['pods', 'Succeeded', 'success'],
    ['pods', 'Pending', 'neutral'],
    ['pods', 'ContainerCreating', 'neutral'],
    ['pods', 'PodInitializing', 'neutral'],
    ['pods', 'SchedulingGated', 'neutral'],
    ['pods', 'Terminating', 'neutral'],
    ['pods', 'Init:0/2', 'neutral'],
    ['pods', 'Init:CrashLoopBackOff', 'error'],
    ['pods', 'CrashLoopBackOff', 'error'],
    ['pods', 'ImagePullBackOff', 'error'],
    ['pods', 'NotReady', 'error'],
    ['pods', 'Error', 'error'],
    ['pods', 'Unknown', 'error'],
    ['jobs', 'Complete', 'success'],
    ['jobs', 'Running', 'neutral'],
    ['jobs', 'Suspended', 'neutral'],
    ['jobs', 'Failed', 'error'],
    ['jobs', 'FailureTarget', 'error'],
    ['persistentvolume', 'Bound', 'success'],
    ['persistentvolume', 'Available', 'success'],
    ['persistentvolume', 'Released', 'neutral'],
    ['persistentvolume', 'Failed', 'error'],
    ['persistentvolumeclaim', 'Bound', 'success'],
    ['persistentvolumeclaim', 'Pending', 'neutral'],
    ['persistentvolumeclaim', 'Lost', 'error'],
    ['nodes', 'Ready', 'success'],
    ['nodes', 'Ready,SchedulingDisabled', 'neutral'],
    ['nodes', 'NotReady', 'error'],
    ['nodes', 'Unknown', 'error'],
    ['deployments', 'Unknown', 'neutral'],
  ] as const)('%s %s is %s', (resourceType, status, variant) => {
    expect(getStatusVariant(status, resourceType)).toBe(variant);
  });
});
