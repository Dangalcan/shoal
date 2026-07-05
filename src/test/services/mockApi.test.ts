import { describe, it, expect } from 'vitest';
import { mockApi } from '../../services/mockApi';

describe('mockApi', () => {
  it('should manage clusters', async () => {
    // Initial state
    let result = await mockApi.getClusters();
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Failed to get clusters');
    const initialCount = result.data.length;

    // Create cluster
    await mockApi.createCluster('new-cluster', 'minikube');
    result = await mockApi.getClusters();
    if (!result.success) throw new Error('Failed to get clusters');
    expect(result.data).toContain('new-cluster');
    const countAfterFirstCreate = result.data.length;

    // Create existing cluster (Branch coverage: createCluster if !mockClusters.includes(name) is false)
    await mockApi.createCluster('new-cluster', 'minikube');
    result = await mockApi.getClusters();
    if (!result.success) throw new Error('Failed to get clusters');
    expect(result.data.length).toBe(countAfterFirstCreate);

    // Set and delete current context (Branch coverage: deleteCluster if mockCurrentContext === name)
    await mockApi.switchContext('new-cluster');
    await mockApi.deleteCluster('new-cluster');
    let currentCtx = await mockApi.getCurrentContext();
    if (!currentCtx.success) throw new Error('Failed to get current context');
    expect(currentCtx.data).not.toBe('new-cluster');
    expect(currentCtx.data).toBe(result.data[0] || '');

    // Delete all clusters to test empty context (Branch coverage: deleteCluster mockClusters[0] || '')
    result = await mockApi.getClusters();
    if (!result.success) throw new Error('Failed to get clusters');
    for (const cluster of result.data) {
      await mockApi.deleteCluster(cluster);
    }
    currentCtx = await mockApi.getCurrentContext();
    if (!currentCtx.success) throw new Error('Failed to get current context');
    expect(currentCtx.data).toBe('');

    // Delete a cluster that is NOT the current context (Branch coverage: deleteCluster if mockCurrentContext === name is false)
    await mockApi.createCluster('c1', 'minikube');
    await mockApi.createCluster('c2', 'minikube');
    await mockApi.switchContext('c1');
    await mockApi.deleteCluster('c2');
    currentCtx = await mockApi.getCurrentContext();
    if (!currentCtx.success) throw new Error('Failed to get current context');
    expect(currentCtx.data).toBe('c1');

    // Restore initial state for other tests if necessary
    await mockApi.deleteCluster('c1');
    await mockApi.createCluster('minikube', 'minikube');
  });

  it('should manage contexts', async () => {
    const clusters = await mockApi.getClusters();
    if (!clusters.success) throw new Error('Failed to get clusters');
    const target = clusters.data[0];
    if (!target) throw new Error('No clusters found');

    // Switch context
    let result = await mockApi.switchContext(target);
    expect(result.success).toBe(true);

    const current = await mockApi.getCurrentContext();
    if (!current.success) throw new Error('Failed to get current context');
    expect(current.data).toBe(target);

    // Switch to invalid
    await mockApi.switchContext('invalid-context').catch((e) => e);
    const invalidResult = await mockApi.switchContext('invalid-context');
    expect(invalidResult.success).toBe(false);
  });

  it('should return mock data for resources', async () => {
    const pods = await mockApi.getPods('ctx');
    if (pods.success) {
      expect(Array.isArray(pods.data)).toBe(true);
    } else {
      throw new Error(pods.error);
    }

    const namespaces = await mockApi.getNamespaces('ctx');
    if (namespaces.success) {
      expect(namespaces.data).toContain('default');
    }

    const resources = await mockApi.getResources({
      contextName: 'ctx',
      resourceType: 'pods',
      namespace: 'default',
    });
    expect(resources.success).toBe(true);
  });

  it('should handle miscellaneous operations', async () => {
    expect((await mockApi.checkTool('kubectl')).success).toBe(true);
    expect((await mockApi.getAppVersion()).success).toBe(true);
    expect((await mockApi.getKubeconfigPath()).success).toBe(true);
    expect((await mockApi.setKubeconfigPath('/new/path')).success).toBe(true);

    // Fix arguments to match ElectronAPI interface
    expect(
      (
        await mockApi.getLogs({
          contextName: 'ctx',
          podName: 'pod',
          namespace: 'default',
        })
      ).success
    ).toBe(true);
    expect(
      (
        await mockApi.describeResource({
          contextName: 'ctx',
          resourceType: 'pod',
          resourceName: 'name',
          namespace: 'default',
        })
      ).success
    ).toBe(true);
    expect(
      (
        await mockApi.getResourceYaml({
          contextName: 'ctx',
          resourceType: 'pod',
          resourceName: 'name',
          namespace: 'default',
        })
      ).success
    ).toBe(true);
    expect(
      (
        await mockApi.rolloutRestart({
          contextName: 'ctx',
          resourceType: 'deploy',
          resourceName: 'dep',
          namespace: 'default',
        })
      ).success
    ).toBe(true);
    expect(
      (
        await mockApi.deleteResource({
          contextName: 'ctx',
          resourceType: 'pod',
          resourceName: 'name',
          namespace: 'default',
        })
      ).success
    ).toBe(true);
  });

  it('should support plugin system operations', async () => {
    expect((await mockApi.getPlugins()).success).toBe(true);
    expect((await mockApi.enablePlugin('test')).success).toBe(true);
    expect((await mockApi.disablePlugin('test')).success).toBe(true);
    expect((await mockApi.checkForPluginUpdates()).success).toBe(true);
    expect((await mockApi.getPluginExtensions()).success).toBe(true);
    expect((await mockApi.executePluginAction('p', 'a')).success).toBe(true);
    expect((await mockApi.getPluginSettings('test')).success).toBe(true);
    expect((await mockApi.setPluginSettings('test', {})).success).toBe(true);
    expect((await mockApi.uninstallPlugin('test')).success).toBe(true);
    expect((await mockApi.activatePluginLicense('p', 'k')).success).toBe(true);
    expect((await mockApi.startPluginTrial('p')).success).toBe(true);
    expect((await mockApi.deactivatePluginLicense('p')).success).toBe(true);
    expect((await mockApi.getMarketplacePlugins()).success).toBe(true);
    expect((await mockApi.installPlugin('test')).success).toBe(true);
    expect(
      (
        await mockApi.generatePlugin({
          id: 'test',
          name: 'test',
          author: 'test',
          description: 'test',
        })
      ).success
    ).toBe(true);
    expect((await mockApi.reloadPlugin('test')).success).toBe(true);
    expect((await mockApi.importLocalPlugin()).success).toBe(true);
  });

  it('should support manifest operations', async () => {
    expect((await mockApi.getManifests()).success).toBe(true);
    expect((await mockApi.saveManifest({})).success).toBe(true);
    expect((await mockApi.deleteManifest(1)).success).toBe(true);
    expect((await mockApi.applyManifest(1)).success).toBe(true);
  });

  it('should have listener methods defined', () => {
    expect(typeof mockApi.onSetKubeconfigPath).toBe('function');
    expect(typeof mockApi.onPluginNotification).toBe('function');

    // Call them to cover the empty function bodies
    mockApi.onSetKubeconfigPath(() => {});
    mockApi.onPluginNotification(() => {});
  });
});
