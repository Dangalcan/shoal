export interface ElectronAPI {
    runCommand: (command: string) => Promise<{ success: boolean; stdout: string; stderr: string; error?: string }>
    checkTool: (tool: string) => Promise<boolean>
}

declare global {
    interface Window {
        electron: ElectronAPI
    }
}
