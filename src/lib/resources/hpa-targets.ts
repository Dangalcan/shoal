import { isRecord } from '../type-guards';

const at = (value: unknown, ...path: string[]): unknown => {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
};

const text = (value: unknown, fallback: string): string =>
  value === undefined || value === null ? fallback : String(value);

const present = (value: unknown): boolean =>
  value !== undefined && value !== null;

const sourceOf = (metric: unknown): string | undefined => {
  if (!isRecord(metric)) return undefined;
  switch (metric.type) {
    case 'Resource':
      return 'resource';
    case 'ContainerResource':
      return 'containerResource';
    case 'Pods':
      return 'pods';
    case 'Object':
      return 'object';
    case 'External':
      return 'external';
    default:
      return undefined;
  }
};

function currentValue(metric: unknown, status: unknown): unknown {
  const source = sourceOf(metric);
  if (!source) return undefined;
  const target = at(metric, source, 'target');
  const current = at(status, source, 'current');
  if (source === 'resource' || source === 'containerResource') {
    return present(at(target, 'averageValue'))
      ? at(current, 'averageValue')
      : at(current, 'averageUtilization');
  }
  if (source === 'pods') return at(current, 'averageValue');
  return present(at(target, 'averageValue'))
    ? at(current, 'averageValue')
    : at(current, 'value');
}

function formatMetric(metric: unknown, status: unknown): string {
  const source = sourceOf(metric);
  if (!source) return '<unknown type>';

  const target = at(metric, source, 'target');
  const current = at(status, source, 'current');
  if (source === 'resource' || source === 'containerResource') {
    const name = text(at(metric, source, 'name'), '<unknown>');
    if (present(at(target, 'averageValue'))) {
      return `${name}: ${text(at(current, 'averageValue'), '<unknown>')}/${text(at(target, 'averageValue'), '<auto>')}`;
    }
    const currentUtilization = at(current, 'averageUtilization');
    const targetUtilization = at(target, 'averageUtilization');
    return `${name}: ${present(currentUtilization) ? `${currentUtilization}%` : '<unknown>'}/${present(targetUtilization) ? `${targetUtilization}%` : '<auto>'}`;
  }
  if (source === 'pods') {
    return `${text(at(current, 'averageValue'), '<unknown>')}/${text(at(target, 'averageValue'), '<auto>')}`;
  }
  if (present(at(target, 'averageValue'))) {
    return `${text(at(current, 'averageValue'), '<unknown>')}/${text(at(target, 'averageValue'), '<auto>')} (avg)`;
  }
  return `${text(at(current, 'value'), '<unknown>')}/${text(at(target, 'value'), '<auto>')}`;
}

/** Matches kubectl's HPA targets cell and its two-value display limit. */
export function hpaTargetsText(
  specMetrics: unknown,
  currentMetrics: unknown
): string {
  const specs = Array.isArray(specMetrics) ? specMetrics : [];
  if (specs.length === 0) return '<none>';

  const statuses = Array.isArray(currentMetrics) ? currentMetrics : [];
  const shown = specs
    .slice(0, 2)
    .map((metric, index) => formatMetric(metric, statuses[index]));
  const more = specs.length - shown.length;
  return `${shown.join(', ')}${more > 0 ? ` + ${more} more...` : ''}`;
}

/** The current value for the first configured metric, used by HPA sorting. */
export function hpaFirstCurrentValue(
  specMetrics: unknown,
  currentMetrics: unknown
): unknown {
  const metric = Array.isArray(specMetrics) ? specMetrics[0] : undefined;
  const status = Array.isArray(currentMetrics) ? currentMetrics[0] : undefined;
  return currentValue(metric, status);
}
