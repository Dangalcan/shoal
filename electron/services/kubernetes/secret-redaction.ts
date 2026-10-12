/**
 * Strips the payload of a Secret before it leaves the Kubernetes service for
 * a plugin event: a plugin that merely listens for resource changes must not
 * receive every Secret the user creates or edits.
 */
export function withoutSecretData(resource: unknown): unknown {
  if (!resource || typeof resource !== 'object') return resource;
  const record = resource as Record<string, unknown>;
  if (record.kind !== 'Secret') return resource;
  const copy: Record<string, unknown> = { ...record };
  delete copy.data;
  delete copy.stringData;
  return copy;
}
