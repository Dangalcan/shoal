/**
 * Field columns
 *
 * Table columns that show one field of a resource, or a short summary of
 * it, and need no cell component of their own. Each column maps to an
 * accessor that returns a comparable value, so the cell and the column sort
 * read the same thing, and, where the text differs from that value
 * (timestamps, units, truncated lists), to the text shown instead. The
 * text follows `kubectl get`.
 */

import type { K8sResource } from '../../types/k8s-types';
import { isRecord } from '../type-guards';
import type { ResourceType } from './resource-types';

/** A comparable cell value; undefined when the field is missing. */
export type FieldValue = string | number | boolean | undefined;

type Accessor = (resource: K8sResource) => FieldValue;

export interface FieldColumn {
  /** The value the cell shows and the column sorts by. */
  readonly value: Accessor;
  /** The text shown when it is not just the formatted value. */
  readonly text?: (resource: K8sResource) => string;
}

/** Text of a missing value. */
export const MISSING_TEXT = '-';
/** kubectl's text for an empty selector or endpoint list. */
const NONE_TEXT = '<none>';
/** kubectl shows the first three items of a long list. */
const LIST_LIMIT = 3;

// Reading fields of unknown shape -------------------------------------------

/** Follows `path` through nested objects; undefined at the first gap. */
function at(value: unknown, ...path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

/** A non-empty string, else undefined. */
const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

const num = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined;

const bool = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

/** The objects of a list; anything else reads as an empty list. */
const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

/** The non-empty strings of a list. */
const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => str(item) !== undefined)
    : [];

/** A non-empty string, a number or a boolean as is; else missing. */
export const toFieldValue = (value: unknown): FieldValue =>
  str(value) ?? num(value) ?? bool(value);

// Formatting ----------------------------------------------------------------

/** Cell text of a value: `-` when missing, `True`/`False` like kubectl. */
export function formatFieldValue(value: FieldValue): string {
  if (value === undefined || value === '') return MISSING_TEXT;
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  return String(value);
}

/** The text a field column shows for a resource. */
export function fieldColumnText(
  column: FieldColumn,
  resource: K8sResource
): string {
  return column.text
    ? column.text(resource)
    : formatFieldValue(column.value(resource));
}

const joined = (items: string[]): string | undefined =>
  items.length > 0 ? items.join(',') : undefined;

/** The first three items, then `+ N more...`, like kubectl. */
export function truncatedList(items: string[]): string {
  const shown = items.slice(0, LIST_LIMIT).join(',');
  const more = items.length - LIST_LIMIT;
  return more > 0 ? `${shown} + ${more} more...` : shown;
}

/** `kind/name` (or `namespace/name`), or whichever of the two is set. */
function kindName(
  kind: string | undefined,
  name: string | undefined
): string | undefined {
  return kind && name ? `${kind}/${name}` : (kind ?? name);
}

/** A kind qualified by its API group (`IngressParameters.example.com`). */
const groupKind = (kind: string | undefined, group: string | undefined) =>
  kind && group ? `${kind}.${group}` : kind;

/** A label map as `k=v` pairs sorted by key, like kubectl. */
function labelPairs(value: unknown): Array<[string, string]> {
  if (!isRecord(value)) return [];
  return Object.keys(value)
    .sort()
    .map((key): [string, string] => [key, `${key}=${str(value[key]) ?? ''}`]);
}

/** A `matchExpressions` entry as kubectl prints it (`key in (a,b)`). */
function expressionPair(
  expression: Record<string, unknown>
): Array<[string, string]> {
  const key = str(expression.key);
  if (!key) return [];
  const values = strings(expression.values).sort().join(',');
  switch (expression.operator) {
    case 'In':
      return [[key, `${key} in (${values})`]];
    case 'NotIn':
      return [[key, `${key} notin (${values})`]];
    case 'Exists':
      return [[key, key]];
    case 'DoesNotExist':
      return [[key, `!${key}`]];
    default:
      return [];
  }
}

/** A label selector as kubectl prints it; an empty one is `<none>`. */
function formatSelector(selector: unknown): string | undefined {
  if (!isRecord(selector)) return undefined;
  const requirements = [
    ...labelPairs(selector.matchLabels),
    ...records(selector.matchExpressions).flatMap(expressionPair),
  ].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return joined(requirements.map(([, text]) => text)) ?? NONE_TEXT;
}

/** `base ** n` for each suffix, `n` counting up from `from`. */
const powers = (suffixes: string[], base: number, from: number) =>
  suffixes.map((suffix, i): [string, number] => [suffix, base ** (i + from)]);

/** Multipliers of the decimal and binary suffixes of a quantity. */
const QUANTITY_SUFFIXES = new Map<string, number>([
  ['m', 1e-3],
  ...powers(['', 'k', 'M', 'G', 'T', 'P', 'E'], 1000, 0),
  ...powers(['Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei'], 1024, 1),
]);

/** A quantity such as `1Gi` or `500M` in base units, to sort by. */
function quantity(value: unknown): number | undefined {
  const match = /^(\d+(?:\.\d+)?)([a-zA-Z]*)$/.exec(str(value) ?? '');
  const factor = QUANTITY_SUFFIXES.get(match?.[2] ?? '');
  return match && factor !== undefined ? Number(match[1]) * factor : num(value);
}

// Column builders -----------------------------------------------------------

/** A string field. */
const stringAt = (...path: string[]): FieldColumn => ({
  value: (r) => str(at(r, ...path)),
});

/** A number field. */
const numberAt = (...path: string[]): FieldColumn => ({
  value: (r) => num(at(r, ...path)),
});

/** A boolean field that is missing when absent. */
const booleanAt = (...path: string[]): FieldColumn => ({
  value: (r) => bool(at(r, ...path)),
});

/** A boolean field that defaults to false. */
const flagAt = (...path: string[]): FieldColumn => ({
  value: (r) => bool(at(r, ...path)) ?? false,
});

/** An int-or-string field (a count or a percentage). */
const intOrStringAt = (...path: string[]): FieldColumn => ({
  value: (r) => {
    const value = at(r, ...path);
    return num(value) ?? str(value);
  },
});

/** The length of a list; absent counts as 0. */
const countAt = (...path: string[]): FieldColumn => ({
  value: (r) => {
    const value = at(r, ...path);
    return Array.isArray(value) ? value.length : 0;
  },
});

/** A list of strings joined with `,`. */
const joinedAt = (...path: string[]): FieldColumn => ({
  value: (r) => joined(strings(at(r, ...path))),
});

/** A list cut to its first three items; sorts by the whole list. */
const listColumn = (
  items: (resource: K8sResource) => string[],
  emptyText = MISSING_TEXT
): FieldColumn => ({
  value: (r) => joined(items(r)),
  text: (r) => {
    const all = items(r);
    return all.length > 0 ? truncatedList(all) : emptyText;
  },
});

/** Any value computed from the resource. */
const computed = (value: Accessor): FieldColumn => ({ value });

// Per-kind accessors --------------------------------------------------------

/** EndpointSlice ports: the number, else the name, else `*` (all ports). */
const slicePorts = (r: K8sResource): string[] =>
  records(at(r, 'ports')).map((p) => String(num(p.port) ?? str(p.name) ?? '*'));

const sliceAddresses = (r: K8sResource): string[] =>
  records(at(r, 'endpoints')).flatMap((e) => strings(e.addresses));

const hostPort = (ip: string, port: number): string =>
  ip.includes(':') ? `[${ip}]:${port}` : `${ip}:${port}`;

/** One Endpoints subset as kubectl lists it: every port of every address. */
function subsetAddresses(subset: Record<string, unknown>): string[] {
  const ips = records(subset.addresses).flatMap((a) => str(a.ip) ?? []);
  const ports = records(subset.ports).flatMap((p) => num(p.port) ?? []);
  if (ports.length === 0) return ips;
  return ports.flatMap((port) => ips.map((ip) => hostPort(ip, port)));
}

const endpointAddresses = (r: K8sResource): string[] =>
  records(at(r, 'subsets')).flatMap(subsetAddresses);

/** `kind.apiGroup/name`, like kubectl. */
function ingressClassParameters(r: K8sResource): string | undefined {
  const params = at(r, 'spec', 'parameters');
  const kind = groupKind(str(at(params, 'kind')), str(at(params, 'apiGroup')));
  return kindName(kind, str(at(params, 'name')));
}

/** `namespace/name` of the backing service; `Local` when there is none. */
function apiServiceRef(r: K8sResource): string | undefined {
  const service = at(r, 'spec', 'service');
  if (!isRecord(service)) return 'Local';
  return kindName(str(service.namespace), str(service.name));
}

/** The Available condition: `True`, else its status and reason. */
function apiServiceAvailable(r: K8sResource): string | undefined {
  const condition = records(at(r, 'status', 'conditions')).find(
    (c) => c.type === 'Available'
  );
  if (!condition) return undefined;
  const status = str(condition.status) ?? 'Unknown';
  const reason = str(condition.reason);
  return status !== 'True' && reason ? `${status} (${reason})` : status;
}

/** When an event was last seen, newest source first. */
const eventLastSeen = (r: K8sResource): string | undefined =>
  str(at(r, 'lastTimestamp')) ??
  str(at(r, 'series', 'lastObservedTime')) ??
  str(at(r, 'eventTime')) ??
  str(at(r, 'metadata', 'creationTimestamp'));

const localTime = (iso: string | undefined): string =>
  iso ? new Date(iso).toLocaleString() : MISSING_TEXT;

/** The object an event is about (`regarding` in events.k8s.io). */
function eventObject(r: K8sResource): string | undefined {
  const involved = at(r, 'involvedObject');
  const ref = isRecord(involved) ? involved : at(r, 'regarding');
  return kindName(str(at(ref, 'kind'))?.toLowerCase(), str(at(ref, 'name')));
}

/** The controlling owner as kubectl prints it (`daemonset.apps/name`). */
function controllerOf(r: K8sResource): string | undefined {
  const owner = records(at(r, 'metadata', 'ownerReferences')).find(
    (o) => o.controller === true
  );
  if (!owner) return undefined;
  const version = str(owner.apiVersion) ?? '';
  const group = version.includes('/') ? version.split('/')[0] : undefined;
  const kind = groupKind(str(owner.kind)?.toLowerCase(), group);
  return kindName(kind, str(owner.name));
}

/** kubectl's CSR condition: the decision, then `Failed` and `Issued`. */
function csrCondition(r: K8sResource): string {
  const types = new Set(
    records(at(r, 'status', 'conditions')).map((c) => c.type)
  );
  const decision = types.has('Denied')
    ? 'Denied'
    : types.has('Approved')
      ? 'Approved'
      : 'Pending';
  const failed = types.has('Failed') ? ['Failed'] : [];
  const issued = str(at(r, 'status', 'certificate')) ? ['Issued'] : [];
  return [decision, ...failed, ...issued].join(',');
}

/** A Pod Security Admission label of a namespace: `level (version)`. */
const podSecurity = (mode: string): FieldColumn =>
  computed((r) => {
    const labels = at(r, 'metadata', 'labels');
    const level = str(at(labels, `pod-security.kubernetes.io/${mode}`));
    const version = str(
      at(labels, `pod-security.kubernetes.io/${mode}-version`)
    );
    return level && version ? `${level} (${version})` : level;
  });

const bindingRole = computed((r) =>
  kindName(str(at(r, 'roleRef', 'kind')), str(at(r, 'roleRef', 'name')))
);

const webhookCount = countAt('webhooks');

// The columns ---------------------------------------------------------------

type ColumnMap = Readonly<Record<string, FieldColumn>>;

const FIELD_COLUMNS: Partial<Record<ResourceType, ColumnMap>> = {
  daemonsets: {
    'node-selector': computed((r) =>
      joined(
        labelPairs(at(r, 'spec', 'template', 'spec', 'nodeSelector')).map(
          ([, text]) => text
        )
      )
    ),
  },
  endpointslices: {
    'address-type': stringAt('addressType'),
    ports: listColumn(slicePorts),
    endpoints: listColumn(sliceAddresses),
    'service-name': stringAt(
      'metadata',
      'labels',
      'kubernetes.io/service-name'
    ),
  },
  cronjobs: {
    suspend: flagAt('spec', 'suspend'),
    active: countAt('status', 'active'),
  },
  persistentvolume: { reason: stringAt('status', 'reason') },
  ingressclass: {
    controller: stringAt('spec', 'controller'),
    parameters: computed(ingressClassParameters),
  },
  networkpolicy: {
    'pod-selector': computed((r) =>
      formatSelector(at(r, 'spec', 'podSelector'))
    ),
    'policy-types': joinedAt('spec', 'policyTypes'),
  },
  serviceaccounts: { secrets: countAt('secrets') },
  volumesnapshot: {
    'ready-to-use': booleanAt('status', 'readyToUse'),
    source: computed(
      (r) =>
        str(at(r, 'spec', 'source', 'persistentVolumeClaimName')) ??
        str(at(r, 'spec', 'source', 'volumeSnapshotContentName'))
    ),
    'snapshot-class': stringAt('spec', 'volumeSnapshotClassName'),
    size: {
      value: (r) => quantity(at(r, 'status', 'restoreSize')),
      text: (r) =>
        formatFieldValue(toFieldValue(at(r, 'status', 'restoreSize'))),
    },
  },
  volumesnapshotclass: {
    driver: stringAt('driver'),
    'deletion-policy': stringAt('deletionPolicy'),
  },
  poddisruptionbudget: {
    'min-available': intOrStringAt('spec', 'minAvailable'),
    'max-unavailable': intOrStringAt('spec', 'maxUnavailable'),
    'allowed-disruptions': numberAt('status', 'disruptionsAllowed'),
  },
  priorityclass: {
    value: numberAt('value'),
    'global-default': flagAt('globalDefault'),
    'preemption-policy': stringAt('preemptionPolicy'),
  },
  runtimeclass: { handler: stringAt('handler') },
  lease: {
    holder: stringAt('spec', 'holderIdentity'),
    duration: {
      value: (r) => num(at(r, 'spec', 'leaseDurationSeconds')),
      text: (r) => {
        const seconds = num(at(r, 'spec', 'leaseDurationSeconds'));
        return seconds === undefined ? MISSING_TEXT : `${seconds}s`;
      },
    },
  },
  mutatingwebhookconfiguration: { webhooks: webhookCount },
  validatingwebhookconfiguration: { webhooks: webhookCount },
  apiservice: {
    service: computed(apiServiceRef),
    available: computed(apiServiceAvailable),
  },
  endpoints: { endpoints: listColumn(endpointAddresses, NONE_TEXT) },
  events: {
    'last-seen': {
      value: eventLastSeen,
      text: (r) => localTime(eventLastSeen(r)),
    },
    type: stringAt('type'),
    reason: stringAt('reason'),
    object: computed(eventObject),
    message: computed((r) => str(at(r, 'message')) ?? str(at(r, 'note'))),
  },
  controllerrevisions: {
    controller: computed(controllerOf),
    revision: numberAt('revision'),
  },
  certificatesigningrequest: {
    requestor: stringAt('spec', 'username'),
    condition: computed(csrCondition),
    'signer-name': stringAt('spec', 'signerName'),
  },
  flowschema: {
    'priority-level': stringAt('spec', 'priorityLevelConfiguration', 'name'),
    strategy: stringAt('spec', 'distinguisherMethod', 'type'),
  },
  prioritylevelconfiguration: { type: stringAt('spec', 'type') },
  rolebinding: { 'binding-role': bindingRole },
  clusterrolebinding: { 'binding-role': bindingRole },
  podsecurityadmission: {
    enforce: podSecurity('enforce'),
    audit: podSecurity('audit'),
    warn: podSecurity('warn'),
  },
};

/** The field column for a kind's column id, if it is one. */
export function getFieldColumn(
  resourceType: ResourceType,
  columnId: string
): FieldColumn | undefined {
  const columns = FIELD_COLUMNS[resourceType];
  return columns && Object.prototype.hasOwnProperty.call(columns, columnId)
    ? columns[columnId]
    : undefined;
}

/** Type order when one column mixes kinds of values (`1` and `50%`). */
const typeRank = (value: string | number | boolean): number =>
  typeof value === 'boolean' ? 0 : typeof value === 'number' ? 1 : 2;

/**
 * Orders two field values: numbers numerically, `false` before `true`, text
 * naturally (`pod-2` before `pod-10`), and missing values after the rest.
 */
export function compareFieldValues(a: FieldValue, b: FieldValue): number {
  if (a === undefined || b === undefined) {
    return (a === undefined ? 1 : 0) - (b === undefined ? 1 : 0);
  }
  if (typeof a !== typeof b) return typeRank(a) - typeRank(b);
  if (typeof a === 'string') {
    return a.localeCompare(String(b), undefined, { numeric: true });
  }
  return Number(a) - Number(b);
}
