import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
    runCommand: (command: string) => ipcRenderer.invoke('run-command', command),
    checkTool: (tool: string) => ipcRenderer.invoke('check-tool', tool),
    createCluster: (name: string, provider: string) => ipcRenderer.invoke('create-cluster', { name, provider }),
    getClusters: () => ipcRenderer.invoke('get-clusters'),
    deleteCluster: (name: string) => ipcRenderer.invoke('delete-cluster', name),
    getCurrentContext: () => ipcRenderer.invoke('get-current-context')
})
