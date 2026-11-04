import { describe, it, expect } from 'vitest';
import { podSpecOf } from '../../../lib/resources/pod-spec';

describe('podSpecOf', () => {
  const podSpec = { containers: [{ name: 'c' }] };

  it('reads a CronJob from its job template', () => {
    const resource = {
      spec: { jobTemplate: { spec: { template: { spec: podSpec } } } },
    };
    expect(podSpecOf(resource)).toBe(podSpec);
  });

  it('reads a workload from its template', () => {
    expect(podSpecOf({ spec: { template: { spec: podSpec } } })).toBe(podSpec);
  });

  it('takes the spec of a bare Pod as it is', () => {
    expect(podSpecOf({ spec: podSpec })).toBe(podSpec);
  });

  it.each([
    ['an empty template', { template: {} }],
    ['an empty job template', { jobTemplate: {} }],
    ['a job template without a pod template', { jobTemplate: { spec: {} } }],
    ['a template spec that is not an object', { template: { spec: 'text' } }],
    ['a template spec that is a list', { template: { spec: [] } }],
  ])('falls back to spec with %s', (_name, spec) => {
    expect(podSpecOf({ spec })).toBe(spec);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'text'],
    ['an object without a spec', {}],
    ['a null spec', { spec: null }],
    ['a spec that is not an object', { spec: 'text' }],
    ['a spec that is a list', { spec: [] }],
  ])('is empty for %s', (_name, resource) => {
    expect(podSpecOf(resource)).toEqual({});
  });
});
