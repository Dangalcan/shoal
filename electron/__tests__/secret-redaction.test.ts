import { describe, it, expect } from 'vitest';
import {
  withoutSecretData,
  withoutSecretDataInList,
  withoutSecretDataInYaml,
} from '../shared/secret-redaction';

const LAST_APPLIED = 'kubectl.kubernetes.io/last-applied-configuration';

const secret = {
  apiVersion: 'v1',
  kind: 'Secret',
  metadata: {
    name: 's',
    namespace: 'default',
    annotations: {
      [LAST_APPLIED]: '{"kind":"Secret","data":{"token":"eA=="}}',
      team: 'a',
    },
  },
  type: 'Opaque',
  data: { token: 'eA==' },
  stringData: { plain: 'text' },
};

describe('withoutSecretData', () => {
  it('passes anything that is not a Secret object through untouched', () => {
    const configMap = { kind: 'ConfigMap', data: { a: 'b' } };
    expect(withoutSecretData(configMap)).toBe(configMap);
    expect(withoutSecretData(null)).toBeNull();
    expect(withoutSecretData('text')).toBe('text');
    const list = [secret];
    expect(withoutSecretData(list)).toBe(list);
  });

  it('removes data, stringData and the last-applied annotation from a Secret', () => {
    const before = JSON.stringify(secret);
    expect(withoutSecretData(secret)).toEqual({
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: 's',
        namespace: 'default',
        annotations: { team: 'a' },
      },
      type: 'Opaque',
    });
    // A copy: the object the service cached keeps its payload.
    expect(JSON.stringify(secret)).toBe(before);
  });

  it('copes with a Secret without annotations or metadata', () => {
    expect(withoutSecretData({ kind: 'Secret', data: { a: 'b' } })).toEqual({
      kind: 'Secret',
    });
    expect(
      withoutSecretData({ kind: 'Secret', metadata: { name: 's' } })
    ).toEqual({ kind: 'Secret', metadata: { name: 's' } });
  });
});

describe('withoutSecretDataInList', () => {
  it('redacts every Secret of a list and leaves the rest alone', () => {
    const pod = { kind: 'Pod' };
    const result = withoutSecretDataInList([secret, pod]) as unknown[];
    expect(result).toHaveLength(2);
    expect(result[0]).not.toHaveProperty('data');
    expect(result[1]).toBe(pod);
  });

  it('handles a single resource and non-list values', () => {
    expect(withoutSecretDataInList(secret)).not.toHaveProperty('data');
    expect(withoutSecretDataInList(undefined)).toBeUndefined();
  });
});

describe('withoutSecretDataInYaml', () => {
  const secretYaml = [
    'apiVersion: v1',
    'data:',
    '  password: cGFzcw==',
    '  token: eA==',
    'kind: Secret',
    'metadata:',
    '  annotations:',
    `    ${LAST_APPLIED}: |`,
    '      {"apiVersion":"v1","data":{"token":"eA=="},"kind":"Secret"}',
    '    team: a',
    '  creationTimestamp: "2026-10-16T00:00:00Z"',
    '  name: s',
    '  namespace: default',
    'stringData:',
    '  plain: text',
    'type: Opaque',
    '',
  ].join('\n');

  it('drops the payload blocks and the last-applied annotation of a Secret', () => {
    expect(withoutSecretDataInYaml(secretYaml)).toBe(
      [
        'apiVersion: v1',
        'kind: Secret',
        'metadata:',
        '  annotations:',
        '    team: a',
        '  creationTimestamp: "2026-10-16T00:00:00Z"',
        '  name: s',
        '  namespace: default',
        'type: Opaque',
        '',
      ].join('\n')
    );
  });

  it('keeps the final newline when a payload block ends the document', () => {
    const yaml = 'kind: Secret\nmetadata:\n  name: s\nstringData:\n  a: b\n';
    expect(withoutSecretDataInYaml(yaml)).toBe(
      'kind: Secret\nmetadata:\n  name: s\n'
    );
    // No trailing newline in, none out.
    expect(withoutSecretDataInYaml('kind: Secret\ndata:\n  a: b')).toBe(
      'kind: Secret'
    );
  });

  it('leaves other kinds untouched, even with data and annotations', () => {
    const configMap = [
      'apiVersion: v1',
      'data:',
      '  a: b',
      'kind: ConfigMap',
      'metadata:',
      '  annotations:',
      `    ${LAST_APPLIED}: |`,
      '      {"kind":"ConfigMap"}',
      '  name: c',
      '',
    ].join('\n');
    expect(withoutSecretDataInYaml(configMap)).toBe(configMap);
  });

  it('redacts each document of a multi-document text on its own', () => {
    const text = `kind: ConfigMap\ndata:\n  a: b\n---\n${secretYaml}---\nkind: Pod\n`;
    const result = withoutSecretDataInYaml(text) as string;
    expect(result.startsWith('kind: ConfigMap\ndata:\n  a: b\n---\n')).toBe(
      true
    );
    expect(result).not.toContain('cGFzcw==');
    expect(result).not.toContain('eA==');
    expect(result).toContain('    team: a\n');
    expect(result.endsWith('---\nkind: Pod\n')).toBe(true);
  });

  it('passes non-string values through', () => {
    expect(withoutSecretDataInYaml(undefined)).toBeUndefined();
    const obj = { kind: 'Secret' };
    expect(withoutSecretDataInYaml(obj)).toBe(obj);
  });
});
