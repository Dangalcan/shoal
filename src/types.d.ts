export interface ElectronAPI {
    runCommand: (command: string) => Promise<{ success: boolean; stdout: string; stderr: string; error?: string }>
    checkTool: (tool: string) => Promise<boolean>
    createCluster: (name: string, provider: string) => Promise<{ success: boolean; error?: string }>
    getClusters: () => Promise<string[]>
    deleteCluster: (name: string) => Promise<{ success: boolean; error?: string }>
    getCurrentContext: () => Promise<string>
}

declare global {
    interface Window {
        electron: ElectronAPI
    }
}
