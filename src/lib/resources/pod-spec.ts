/**
 * The pod spec a workload's containers and images live in.
 *
 * A Deployment, ReplicaSet, StatefulSet, DaemonSet or Job keeps it at
 * `spec.template.spec`; a CronJob adds one level, at
 * `spec.jobTemplate.spec.template.spec`. A bare Pod has `spec` itself.
 */

import { at, isRecord } from '../type-guards';

/** The object at `path`; undefined when the path ends in anything else. */
const recordAt = (
  value: unknown,
  ...path: string[]
): Record<string, unknown> | undefined => {
  const found = at(value, ...path);
  return isRecord(found) ? found : undefined;
};

export const podSpecOf = (resource: unknown): Record<string, unknown> => {
  const spec = recordAt(resource, 'spec') ?? {};
  return (
    recordAt(spec, 'jobTemplate', 'spec', 'template', 'spec') ??
    recordAt(spec, 'template', 'spec') ??
    spec
  );
};
