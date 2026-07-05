/**
 * Kubernetes Argument Validation
 *
 * Shared validators for every value that ends up as a kubectl/kind/k3d
 * argument. Lives in utils (not the IPC layer) so the SERVICE layer can
 * enforce it — services are reachable from plugins, which must not be able
 * to bypass validation by skipping the IPC layer.
 *
 * safeExec already prevents shell injection; these checks additionally
 * stop argument injection (e.g. a "name" of "--kubeconfig=/evil") and
 * keep error messages sane.
 */

/** Kubernetes context names: alphanumeric + .-_@/: */
const CONTEXT_NAME_RE = /^[a-zA-Z0-9._\-@/:]+$/;
/** Kubernetes resource types: alphanumeric + ./ */
const RESOURCE_TYPE_RE = /^[a-zA-Z0-9./]+$/;
/** Kubernetes namespaces: RFC 1123 DNS label, or the literal "all" */
const NAMESPACE_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$|^all$/;
/** Kubernetes resource/pod names: alphanumeric + .-_ */
const RESOURCE_NAME_RE = /^[a-zA-Z0-9._-]+$/;
/** Cluster names for kind/k3d: RFC 1123-ish */
const CLUSTER_NAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;

function assertNoFlag(v: string, label: string): void {
  // Defense in depth: nothing we validate may ever start with "-",
  // so a value can never be smuggled in as a kubectl flag.
  if (v.startsWith('-')) throw new Error(`Invalid ${label}: "${v}"`);
}

export function assertContext(v: string): void {
  if (!v || !CONTEXT_NAME_RE.test(v))
    throw new Error(`Invalid context name: "${v}"`);
  assertNoFlag(v, 'context name');
}

export function assertResourceType(v: string): void {
  if (!v || !RESOURCE_TYPE_RE.test(v))
    throw new Error(`Invalid resource type: "${v}"`);
}

export function assertNamespace(v: string): void {
  if (!v || !NAMESPACE_RE.test(v)) throw new Error(`Invalid namespace: "${v}"`);
}

export function assertResourceName(v: string): void {
  if (!v || !RESOURCE_NAME_RE.test(v))
    throw new Error(`Invalid resource name: "${v}"`);
  assertNoFlag(v, 'resource name');
}

export function assertClusterName(v: string): void {
  if (!v || !CLUSTER_NAME_RE.test(v))
    throw new Error(`Invalid cluster name: "${v}"`);
}
