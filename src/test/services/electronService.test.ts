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

  it('scaleResource calls window.electron.scaleResource', async () => {
    const args = {
      contextName: 'ctx',
      resourceType: 'deployments',
      resourceName: 'web',
      namespace: 'default',
      replicas: 4,
    };
    await electronService.scaleResource(args);
    expect(getMockApi().scaleResource).toHaveBeenCalledWith(args);
  });

  it('createCheckout calls window.electron.createCheckout', async () => {
    await electronService.createCheckout('paid-plugin');
    expect(getMockApi().createCheckout).toHaveBeenCalledWith('paid-plugin');
  });

  it('getCheckoutStatus calls window.electron.getCheckoutStatus', async () => {
    await electronService.getCheckoutStatus('cs_123');
    expect(getMockApi().getCheckoutStatus).toHaveBeenCalledWith('cs_123');
  });

  it('checkForPluginUpdates calls window.electron.checkForPluginUpdates', async () => {
    await electronService.checkForPluginUpdates();
    expect(getMockApi().checkForPluginUpdates).toHaveBeenCalled();
  });

  it('getPlugins calls window.electron.getPlugins', async () => {
    await electronService.getPlugins();
    expect(getMockApi().getPlugins).toHaveBeenCalled();
  });

  it('installPlugin calls window.electron.installPlugin', async () => {
    await electronService.installPlugin('test-plugin');
    expect(getMockApi().installPlugin).toHaveBeenCalledWith('test-plugin');
  });

  it('activatePluginLicense calls window.electron.activatePluginLicense', async () => {
    await electronService.activatePluginLicense('test-plugin', 'license-key');
    expect(getMockApi().activatePluginLicense).toHaveBeenCalledWith(
      'test-plugin',
      'license-key'
    );
  });

  it('startPluginTrial calls window.electron.startPluginTrial', async () => {
    await electronService.startPluginTrial('test-plugin');
    expect(getMockApi().startPluginTrial).toHaveBeenCalledWith('test-plugin');
  });

  it('deactivatePluginLicense calls window.electron.deactivatePluginLicense', async () => {
    await electronService.deactivatePluginLicense('test-plugin');
    expect(getMockApi().deactivatePluginLicense).toHaveBeenCalledWith(
      'test-plugin'
    );
  });

  it('generatePlugin calls window.electron.generatePlugin', async () => {
    const options: any = {
      id: 'test-plugin',
      name: 'New Plugin',
      author: 'test-author',
      description: 'test-desc',
    };
    await electronService.generatePlugin(options);
    expect(getMockApi().generatePlugin).toHaveBeenCalledWith(options);
  });

  it('reloadPlugin calls window.electron.reloadPlugin', async () => {
    await electronService.reloadPlugin('test-plugin');
    expect(getMockApi().reloadPlugin).toHaveBeenCalledWith('test-plugin');
  });

  it('saveManifest calls window.electron.saveManifest', async () => {
    const manifest = { content: 'yaml' };
    await electronService.saveManifest(manifest);
    expect(getMockApi().saveManifest).toHaveBeenCalledWith(manifest);
  });
});
