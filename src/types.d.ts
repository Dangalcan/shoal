export interface ElectronAPI {
    runCommand: (command: string) => Promise<{ success: boolean; stdout: string; stderr: string; error?: string }>
    checkTool: (tool: string) => Promise<boolean>
    createCluster: (name: string, provider: string) => Promise<{ success: boolean; error?: string }>
    getClusters: () => Promise<string[]>
    deleteCluster: (name: string) => Promise<{ success: boolean; error?: string }>
    getCurrentContext: () => Promise<string>
    getPods: (contextName: string) => Promise<{ success: boolean; pods?: any[]; error?: string }>
    getNamespaces: (contextName: string) => Promise<{ success: boolean; namespaces?: string[]; error?: string }>
    getResources: (args: { contextName: string; resourceType: string; namespace: string }) => Promise<{ success: boolean; items?: any[]; error?: string }>
}

declare global {
    interface Window {
        electron: ElectronAPI
    }
}
