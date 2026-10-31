/**
 * Secret redaction
 *
 * Strips the payload of a Secret before it reaches a plugin without the
 * `secrets` permission: resources read or watched through the PluginContext,
 * resource events, and the lists and YAML the sandbox SDK returns. Pure
 * module, shared by the main process and the renderer bridge.
 *
 * Removed from a Secret: `data`, `stringData` and the
 * `kubectl.kubernetes.io/last-applied-configuration` annotation, which holds
 * the whole object as it was applied, data included.
 */

const LAST_APPLIED = 'kubectl.kubernetes.io/last-applied-configuration';

type Dict = Record<string, unknown>;

function isDict(value: unknown): value is Dict {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** A copy of `resource` without its Secret payload; other kinds pass through. */
export function withoutSecretData(resource: unknown): unknown {
  if (!isDict(resource) || resource.kind !== 'Secret') return resource;
  const copy: Dict = { ...resource };
  delete copy.data;
  delete copy.stringData;
  if (isDict(copy.metadata) && isDict(copy.metadata.annotations)) {
    const annotations: Dict = { ...copy.metadata.annotations };
    delete annotations[LAST_APPLIED];
    copy.metadata = { ...copy.metadata, annotations };
  }
  return copy;
}

/** `withoutSecretData` over a list result; a single resource is handled too. */
export function withoutSecretDataInList(value: unknown): unknown {
  return Array.isArray(value)
    ? value.map(withoutSecretData)
    : withoutSecretData(value);
}

/** Top-level keys of a Secret document that carry its payload. */
const PAYLOAD_KEY = /^(data|stringData):/;

/**
 * Same redaction for `kubectl get -o yaml` text, which is block style with
 * unindented top-level keys: the `data:` and `stringData:` blocks and the
 * last-applied annotation (any depth) are dropped from every document whose
 * top-level `kind` is `Secret`. Anything that is not a string passes through.
 */
export function withoutSecretDataInYaml(yaml: unknown): unknown {
  if (typeof yaml !== 'string') return yaml;
  return yaml
    .split(/^---[ \t]*$/m)
    .map(redactDocument)
    .join('---');
}

function redactDocument(doc: string): string {
  const lines = doc.split('\n');
  if (!lines.some((line) => /^kind:[ \t]*Secret[ \t]*$/.test(line))) {
    return doc;
  }
  const kept: string[] = [];
  // Indent of the key whose block is being dropped; null outside a block.
  let dropping: number | null = null;
  for (const line of lines) {
    const indent = line.search(/\S/); // -1 for a blank line
    if (dropping !== null) {
      if (indent === -1 || indent > dropping) continue;
      dropping = null;
    }
    const content = indent === -1 ? '' : line.slice(indent);
    if (
      (indent === 0 && PAYLOAD_KEY.test(content)) ||
      content.startsWith(`${LAST_APPLIED}:`)
    ) {
      dropping = indent;
      continue;
    }
    kept.push(line);
  }
  // A dropped block at the end of the document swallowed the final newline.
  if (doc.endsWith('\n') && kept[kept.length - 1] !== '') kept.push('');
  return kept.join('\n');
}
