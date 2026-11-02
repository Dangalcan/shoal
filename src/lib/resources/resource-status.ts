/**
 * The Status column says what `kubectl get` says, so a table and a terminal
 * never disagree. A port of the status logic of printPod, printJob,
 * printPersistentVolume, printPersistentVolumeClaim and printNode in
 * kubernetes/kubernetes, pkg/printers/internalversion/printers.go; keep the
 * order of the checks when changing it, it decides which reason wins.
 */

import type {
  Container,
  ContainerStatus,
  Job,
  K8sResource,
  Node,
  PersistentVolume,
  PersistentVolumeClaim,
  Pod,
  PodCondition,
} from '../../types/k8s-types';
import type { StatusVariant } from '../../components/ui/StatusBadge';
import type { ResourceType } from './resource-definitions';

const UNKNOWN = 'Unknown';
const TERMINATING = 'Terminating';

function isConditionTrue(
  conditions: PodCondition[] | undefined,
  type: string
): boolean {
  return conditions?.find((c) => c.type === type)?.status === 'True';
}

/** kubectl's fallback for a terminated container that gives no reason. */
function terminatedReason(
  terminated: NonNullable<NonNullable<ContainerStatus['state']>['terminated']>
): string {
  if (terminated.reason) return terminated.reason;
  return terminated.signal
    ? `Signal:${terminated.signal}`
    : `ExitCode:${terminated.exitCode ?? 0}`;
}

/** An init container that no longer holds initialization back. */
function isInitContainerDone(
  container: ContainerStatus,
  specs: Container[]
): boolean {
  if (container.state?.terminated?.exitCode === 0) return true;
  // A sidecar (an init container with restartPolicy: Always) runs for the
  // life of the pod; once started it counts as done.
  const spec = specs.find((c) => c.name === container.name);
  return spec?.restartPolicy === 'Always' && Boolean(container.started);
}

/** Why the pod is still initializing, or null once its init containers are done. */
function getInitReason(pod: Pod): string | null {
  const specs = pod.spec?.initContainers ?? [];
  const statuses = pod.status?.initContainerStatuses ?? [];

  const index = statuses.findIndex((c) => !isInitContainerDone(c, specs));
  if (index === -1) return null;

  const { terminated, waiting } = statuses[index]?.state ?? {};
  if (terminated) return `Init:${terminatedReason(terminated)}`;
  if (waiting?.reason && waiting.reason !== 'PodInitializing') {
    return `Init:${waiting.reason}`;
  }
  return `Init:${index}/${specs.length}`;
}

/** A finished container next to one still running is not a finished pod. */
function resolveCompleted(
  pod: Pod,
  hasRunning: boolean,
  errorReason: string
): string {
  if (hasRunning && isConditionTrue(pod.status?.conditions, 'Ready')) {
    return 'Running';
  }
  if (errorReason) return errorReason;
  return hasRunning ? 'NotReady' : 'Completed';
}

/** The reason the containers give, starting from what the pod says so far. */
function getContainerReason(pod: Pod, podReason: string): string {
  const statuses = pod.status?.containerStatuses ?? [];
  let reason = podReason;
  let errorReason = '';
  let hasRunning = false;

  // Last to first, as kubectl: the first container's reason wins.
  for (const container of [...statuses].reverse()) {
    const { waiting, terminated, running } = container.state ?? {};
    if (waiting?.reason) {
      reason = waiting.reason;
    } else if (terminated) {
      reason = terminatedReason(terminated);
      if (terminated.exitCode) errorReason = reason;
    } else if (container.ready && running) {
      hasRunning = true;
    }
  }

  return reason === 'Completed'
    ? resolveCompleted(pod, hasRunning, errorReason)
    : reason;
}

/** What a pod being deleted reads, or null when deletion changes nothing. */
function getDeletionStatus(pod: Pod): string | null {
  if (!pod.metadata?.deletionTimestamp) return null;
  if (pod.status?.reason === 'NodeLost') return UNKNOWN;
  const phase = pod.status?.phase;
  return phase === 'Succeeded' || phase === 'Failed' ? null : TERMINATING;
}

/** What the pod says about itself, before asking its containers. */
function getPodReason(pod: Pod): string {
  const status = pod.status;
  const gated = status?.conditions?.some(
    (c) => c.type === 'PodScheduled' && c.reason === 'SchedulingGated'
  );
  if (gated) return 'SchedulingGated';
  return status?.reason || status?.phase || UNKNOWN;
}

export function getPodStatus(pod: Pod): string {
  const deletion = getDeletionStatus(pod);
  if (deletion) return deletion;

  const initReason = getInitReason(pod);
  const reason = initReason ?? getPodReason(pod);
  return !initReason || isConditionTrue(pod.status?.conditions, 'Initialized')
    ? getContainerReason(pod, reason)
    : reason;
}

export function getJobStatus(job: Job): string {
  const conditions = job.status?.conditions;
  if (isConditionTrue(conditions, 'Complete')) return 'Complete';
  if (isConditionTrue(conditions, 'Failed')) return 'Failed';
  if (job.metadata?.deletionTimestamp) return TERMINATING;
  if (isConditionTrue(conditions, 'Suspended')) return 'Suspended';
  if (isConditionTrue(conditions, 'FailureTarget')) return 'FailureTarget';
  if (isConditionTrue(conditions, 'SuccessCriteriaMet')) {
    return 'SuccessCriteriaMet';
  }
  return 'Running';
}

export function getVolumeStatus(
  volume: PersistentVolume | PersistentVolumeClaim
): string {
  if (volume.metadata?.deletionTimestamp) return TERMINATING;
  return volume.status?.phase || UNKNOWN;
}

export function getNodeStatus(node: Node): string {
  const ready = node.status?.conditions?.find((c) => c.type === 'Ready');
  let status = UNKNOWN;
  if (ready) status = ready.status === 'True' ? 'Ready' : 'NotReady';
  return node.spec?.unschedulable ? `${status},SchedulingDisabled` : status;
}

/** The text of the Status column for a kind that has one. */
export function getResourceStatus(
  resource: K8sResource,
  resourceType: ResourceType
): string {
  switch (resourceType) {
    case 'pods':
      return getPodStatus(resource as Pod);
    case 'jobs':
      return getJobStatus(resource as Job);
    case 'persistentvolume':
      return getVolumeStatus(resource as PersistentVolume);
    case 'persistentvolumeclaim':
      return getVolumeStatus(resource as PersistentVolumeClaim);
    case 'nodes':
      return getNodeStatus(resource as Node);
    default:
      return UNKNOWN;
  }
}

/** Pods on their way up or down; any other status that is not healthy is a problem. */
const POD_IN_PROGRESS = new Set([
  'Pending',
  'ContainerCreating',
  'PodInitializing',
  'SchedulingGated',
  TERMINATING,
]);

function getPodVariant(status: string): StatusVariant {
  if (['Running', 'Completed', 'Succeeded'].includes(status)) return 'success';
  if (POD_IN_PROGRESS.has(status) || /^Init:\d+\/\d+$/.test(status)) {
    return 'neutral';
  }
  return 'error';
}

function getNodeVariant(status: string): StatusVariant {
  if (status === 'Ready') return 'success';
  return status.startsWith('Ready,') ? 'neutral' : 'error';
}

/** How a status reads at a glance: the colour of its badge. */
export function getStatusVariant(
  status: string,
  resourceType: ResourceType
): StatusVariant {
  switch (resourceType) {
    case 'pods':
      return getPodVariant(status);
    case 'nodes':
      return getNodeVariant(status);
    case 'jobs':
      if (status === 'Complete') return 'success';
      return status === 'Failed' || status === 'FailureTarget'
        ? 'error'
        : 'neutral';
    case 'persistentvolume':
      if (status === 'Bound' || status === 'Available') return 'success';
      return status === 'Failed' ? 'error' : 'neutral';
    case 'persistentvolumeclaim':
      if (status === 'Bound') return 'success';
      return status === 'Lost' ? 'error' : 'neutral';
    default:
      return 'neutral';
  }
}
