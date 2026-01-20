import { describe, it, expect, vi } from 'vitest';
import { electronService } from '../../services/electronService';

describe('ElectronService', () => {
  const getMockApi = () => (window as any).electron;

  it('should be a singleton', () => {
    const instance1 = (electronService as any).constructor.getInstance();
    const instance2 = (electronService as any).constructor.getInstance();
    expect(instance1).toBe(instance2);
    expect(instance1).toBe(electronService);
  });

  it('runCommand calls window.electron.runCommand', async () => {
    const cmd = 'ls -la';
    await electronService.runCommand(cmd);
    expect(getMockApi().runCommand).toHaveBeenCalledWith(cmd);
  });

  it('checkTool calls window.electron.checkTool', async () => {
    const tool = 'kubectl';
    await electronService.checkTool(tool);
    expect(getMockApi().checkTool).toHaveBeenCalledWith(tool);
  });

  it('createCluster calls window.electron.createCluster', async () => {
    await electronService.createCluster('my-cluster', 'kind');
    expect(getMockApi().createCluster).toHaveBeenCalledWith(
      'my-cluster',
      'kind'
    );
  });

  it('getClusters calls window.electron.getClusters', async () => {
    await electronService.getClusters();
    expect(getMockApi().getClusters).toHaveBeenCalled();
  });

  it('deleteCluster calls window.electron.deleteCluster', async () => {
    await electronService.deleteCluster('my-cluster');
    expect(getMockApi().deleteCluster).toHaveBeenCalledWith('my-cluster');
  });

  it('getCurrentContext calls window.electron.getCurrentContext', async () => {
    await electronService.getCurrentContext();
    expect(getMockApi().getCurrentContext).toHaveBeenCalled();
  });

  it('getPods calls window.electron.getPods', async () => {
    await electronService.getPods('test-context');
    expect(getMockApi().getPods).toHaveBeenCalledWith('test-context');
  });

  it('getNamespaces calls window.electron.getNamespaces', async () => {
    await electronService.getNamespaces('test-context');
    expect(getMockApi().getNamespaces).toHaveBeenCalledWith('test-context');
  });

  it('getResources calls window.electron.getResources', async () => {
    const args = {
      contextName: 'ctx',
      resourceType: 'pods',
      namespace: 'default',
    };
    await electronService.getResources(args);
    expect(getMockApi().getResources).toHaveBeenCalledWith(args);
  });

  it('getLogs calls window.electron.getLogs', async () => {
    const args = { contextName: 'ctx', podName: 'pod', namespace: 'default' };
    await electronService.getLogs(args);
    expect(getMockApi().getLogs).toHaveBeenCalledWith(args);
  });

  it('describeResource calls window.electron.describeResource', async () => {
    const args = {
      contextName: 'ctx',
      resourceType: 'pods',
      resourceName: 'pod',
      namespace: 'default',
    };
    await electronService.describeResource(args);
    expect(getMockApi().describeResource).toHaveBeenCalledWith(args);
  });

  it('getResourceYaml calls window.electron.getResourceYaml', async () => {
    const args = {
      contextName: 'ctx',
      resourceType: 'pods',
      resourceName: 'pod',
      namespace: 'default',
    };
    await electronService.getResourceYaml(args);
    expect(getMockApi().getResourceYaml).toHaveBeenCalledWith(args);
  });

  it('rolloutRestart calls window.electron.rolloutRestart', async () => {
    const args = {
      contextName: 'ctx',
      resourceType: 'deployments',
      resourceName: 'dep',
      namespace: 'default',
    };
    await electronService.rolloutRestart(args);
    expect(getMockApi().rolloutRestart).toHaveBeenCalledWith(args);
  });

  it('deleteResource calls window.electron.deleteResource', async () => {
    const args = {
      contextName: 'ctx',
      resourceType: 'pods',
      resourceName: 'pod',
      namespace: 'default',
    };
    await electronService.deleteResource(args);
    expect(getMockApi().deleteResource).toHaveBeenCalledWith(args);
  });
});
