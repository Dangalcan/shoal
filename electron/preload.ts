import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
    runCommand: (command: string) => ipcRenderer.invoke('run-command', command),
    checkTool: (tool: string) => ipcRenderer.invoke('check-tool', tool),
    createCluster: (name: string, provider: string) => ipcRenderer.invoke('create-cluster', { name, provider }),
    getClusters: () => ipcRenderer.invoke('get-clusters'),
    deleteCluster: (name: string) => ipcRenderer.invoke('delete-cluster', name),
    getCurrentContext: () => ipcRenderer.invoke('get-current-context'),
    getPods: (contextName: string) => ipcRenderer.invoke('get-pods', contextName),
    getNamespaces: (contextName: string) => ipcRenderer.invoke('get-namespaces', contextName),
    getResources: (args: { contextName: string; resourceType: string; namespace: string }) => ipcRenderer.invoke('get-resources', args)
})
