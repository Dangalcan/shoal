/**
 * The pod spec a workload's containers and images live in.
 *
 * A Deployment, StatefulSet, DaemonSet or Job keeps it at
 * `spec.template.spec`; a CronJob adds one level, at
 * `spec.jobTemplate.spec.template.spec`. A bare Pod has `spec` itself.
 */

type Record_ = Record<string, unknown>;

const record = (value: unknown): Record_ | undefined =>
  value !== null && typeof value === 'object' ? (value as Record_) : undefined;

export const podSpecOf = (resource: unknown): Record_ => {
  const spec = record(record(resource)?.spec) ?? {};
  const jobTemplate = record(spec.jobTemplate);
  const jobPodSpec = record(record(record(jobTemplate?.spec)?.template)?.spec);
  if (jobPodSpec) return jobPodSpec;

  const podSpec = record(record(spec.template)?.spec);
  return podSpec ?? spec;
};
