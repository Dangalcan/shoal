import { describe, it, expect } from 'vitest';
import { hostEnvironment } from '../services/plugins/host/host-environment';

describe('hostEnvironment', () => {
  it('passes only what a host process needs', () => {
    expect(
      hostEnvironment({
        PATH: '/usr/bin',
        HOME: '/home/ana',
        KUBECONFIG: '/home/ana/.kube/config',
        AWS_SECRET_ACCESS_KEY: 'nope',
        GITHUB_TOKEN: 'nope',
        LANG: 'en_US.UTF-8',
      })
    ).toEqual({ PATH: '/usr/bin', HOME: '/home/ana', LANG: 'en_US.UTF-8' });
  });

  it('skips unset variables', () => {
    expect(hostEnvironment({})).toEqual({});
  });
});
