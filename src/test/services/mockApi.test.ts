import { describe, it, expect } from 'vitest';
import { mockApi } from '../../services/mockApi';
import type { Result } from '../../types/result';

/** Unwraps a successful Result; a failure fails the test with its error. */
function dataOf<T>(result: Result<T>): T {
  if (!result.success) throw new Error(result.error);
  return result.data;
}

describe('mockApi', () => {
  it('should manage clusters', async () => {
    // Initial state
    let result = await mockApi.getClusters();
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Failed to get clusters');

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
    const result = await mockApi.switchContext(target);
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

  it('should support manifest folder operations', async () => {
    expect((await mockApi.getManifestFolders()).success).toBe(true);
    expect((await mockApi.saveManifestFolder({ name: 'f' })).success).toBe(
      true
    );
    expect((await mockApi.deleteManifestFolder(1)).success).toBe(true);
    expect((await mockApi.deleteManifestFolder(1, 'recursive')).success).toBe(
      true
    );
    expect((await mockApi.moveManifest(1, null)).success).toBe(true);
    expect((await mockApi.moveManifestFolder(1, 2)).success).toBe(true);
  });

  it('should scale resources', async () => {
    const result = await mockApi.scaleResource({
      contextName: 'ctx',
      resourceType: 'deployments',
      resourceName: 'web',
      namespace: 'default',
      replicas: 3,
    });
    expect(result.success).toBe(true);
  });

  it('should support the marketplace checkout flow', async () => {
    const checkout = await mockApi.createCheckout('paid-plugin');
    expect(checkout.success).toBe(true);
    if (!checkout.success) throw new Error('checkout failed');
    expect(checkout.data.sessionId).toBeTruthy();
    expect(checkout.data.url).toMatch(/^https?:\/\//);

    const status = await mockApi.getCheckoutStatus(checkout.data.sessionId);
    expect(status.success).toBe(true);
    if (!status.success) throw new Error('status failed');
    expect(status.data.status).toBe('paid');
    expect(status.data.licenseKey).toBeTruthy();
  });

  it('should have listener methods defined', () => {
    expect(typeof mockApi.onPluginNotification).toBe('function');

    // Call them to cover the empty function bodies (and the returned unsub fn)
    mockApi.onPluginNotification(() => {})();
  });

  it('should cover external + terminal stubs', async () => {
    expect((await mockApi.openExternal('https://example.com')).success).toBe(
      true
    );

    // Terminal stubs are not available in browser mode
    expect((await mockApi.terminalCreate({ kind: 'local' })).success).toBe(
      false
    );
    expect((await mockApi.terminalShells()).success).toBe(false);
    expect((await mockApi.terminalInput('s', 'data')).success).toBe(false);
    expect((await mockApi.terminalResize('s', 80, 24)).success).toBe(false);
    expect((await mockApi.terminalKill('s')).success).toBe(false);
    expect((await mockApi.terminalInterrupt('s')).success).toBe(false);

    // Port forward stubs
    expect(
      (
        await mockApi.portForwardStart({
          contextName: 'c',
          namespace: 'default',
          resourceType: 'pod',
          resourceName: 'p',
          localPort: 8080,
          remotePort: 80,
        })
      ).success
    ).toBe(false);
    expect((await mockApi.portForwardStop('id')).success).toBe(false);
    expect((await mockApi.portForwardList()).success).toBe(true);
    mockApi.onPortForwardClosed(() => {})();

    // Log streaming stubs: follow mode needs kubectl
    expect(
      (
        await mockApi.logStreamStart({
          contextName: 'c',
          podName: 'p',
          namespace: 'default',
        })
      ).success
    ).toBe(false);
    expect(await mockApi.logStreamStop('s')).toEqual({
      success: true,
      data: false,
    });
    mockApi.onLogStreamLines(() => {})();
    mockApi.onLogStreamEnded(() => {})();

    // Listeners: verify they are functions, then invoke bodies + unsubscribe fns
    expect(typeof mockApi.onPluginModal).toBe('function');
    expect(typeof mockApi.onTerminalOutput).toBe('function');
    expect(typeof mockApi.onTerminalExited).toBe('function');

    mockApi.onPluginModal(() => {})();
    mockApi.onTerminalOutput(() => {})();
    mockApi.onTerminalExited(() => {})();
  });

  it('answers app info, tool, metrics and update calls with canned data', async () => {
    expect(dataOf(await mockApi.getToolStatus('kubectl'))).toMatchObject({
      tool: 'kubectl',
      installed: true,
    });
    expect(dataOf(await mockApi.getFeatureFlags())).toEqual({
      marketplace: true,
    });
    expect(dataOf(await mockApi.getAppInfo())?.logsPath).toBe('/mock/logs');
    expect((await mockApi.openLogsFolder()).success).toBe(true);
    expect((await mockApi.logRendererError({} as never)).success).toBe(true);
    expect(
      dataOf(
        await mockApi.getPodMetrics({
          contextName: 'ctx',
          namespace: 'default',
        })
      )
    ).toEqual([]);
    expect(dataOf(await mockApi.checkForAppUpdates())).toBe('dev');
    expect((await mockApi.installAppUpdate()).success).toBe(true);
    mockApi.onUpdateStatus(() => {})();
  });

  it('answers Helm calls with canned output', async () => {
    expect(dataOf(await mockApi.helmInstall({} as never))).toBe(
      'Mock install success'
    );
    expect(dataOf(await mockApi.helmUpgrade({} as never))).toBe(
      'Mock upgrade success'
    );
    expect(dataOf(await mockApi.helmRollback({} as never))).toBe(
      'Mock rollback success'
    );
    expect(dataOf(await mockApi.helmUninstall({} as never))).toBe(
      'Mock uninstall success'
    );
    expect(
      dataOf(await mockApi.helmRepoAdd({ name: 'a', url: 'https://a' }))
    ).toBe('Mock repo added');
    expect(dataOf(await mockApi.helmRepoList())).toEqual([]);
  });

  it('walks through a migration', async () => {
    expect(dataOf(await mockApi.migrationCheckKompose())?.available).toBe(true);
    const file = await mockApi.migrationSelectComposeFile();
    expect(dataOf(file)).toEqual({
      token: 'mock-compose-token',
      filePath: '/mock/docker-compose.yml',
    });

    const conversion = await mockApi.migrationConvertCompose(
      dataOf(file)!.token
    );
    expect(dataOf(conversion).manifests.map((m) => m.kind)).toEqual([
      'Deployment',
      'Service',
    ]);

    const imported = await mockApi.migrationImportManifests({
      projectName: 'web',
      contextName: 'kind-dev',
      manifests: dataOf(conversion).manifests.map((m) => ({
        name: m.name,
        content: m.content,
      })) as never,
    });
    expect(dataOf(imported)).toEqual({ folderId: 1, manifestIds: [1, 2] });
  });
});
