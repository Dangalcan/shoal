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
    getLogs: (args: { contextName: string; podName: string; namespace: string }) => Promise<{ success: boolean; logs?: string; error?: string }>
    describeResource: (args: { contextName: string; resourceType: string; resourceName: string; namespace: string }) => Promise<{ success: boolean; output?: string; error?: string }>
    getResourceYaml: (args: { contextName: string; resourceType: string; resourceName: string; namespace: string }) => Promise<{ success: boolean; yaml?: string; error?: string }>
    rolloutRestart: (args: { contextName: string; resourceType: string; resourceName: string; namespace: string }) => Promise<{ success: boolean; error?: string }>
    deleteResource: (args: { contextName: string; resourceType: string; resourceName: string; namespace: string }) => Promise<{ success: boolean; error?: string }>
}

declare global {
    interface Window {
        electron: ElectronAPI
    }
}
