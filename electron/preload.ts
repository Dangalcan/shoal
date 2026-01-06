import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
    runCommand: (command: string) => ipcRenderer.invoke('run-command', command),
    checkTool: (tool: string) => ipcRenderer.invoke('check-tool', tool)
})
