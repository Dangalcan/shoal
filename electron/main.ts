import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { exec } from 'child_process'
import util from 'util'

const execPromise = util.promisify(exec)

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
    const dist = process.env.DIST
    const publicDir = process.env.VITE_PUBLIC

    if (!dist || !publicDir) {
        throw new Error('DIST or VITE_PUBLIC is undefined')
    }

    win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(publicDir, 'electron-vite.svg'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    })

    // IPC Handlers
    ipcMain.handle('run-command', async (_event, command) => {
        try {
            const { stdout, stderr } = await execPromise(command as string)
            return { success: true, stdout, stderr }
        } catch (error: any) {
            return { success: false, error: error.message, stderr: error.stderr }
        }
    })

    ipcMain.handle('check-tool', async (_event, tool) => {
        try {
            await execPromise(`${tool} --version`)
            return true
        } catch {
            return false
        }
    })

    ipcMain.handle('create-cluster', async (_event, { name, provider }) => {
        // For now we only support 'kind'
        const command = `kind create cluster --name ${name}`
        try {
            await execPromise(command)
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('get-clusters', async () => {
        try {
            const { stdout } = await execPromise('kubectl config get-contexts -o name')
            const clusters = stdout.trim().split('\n').filter(Boolean)
            return clusters
        } catch {
            return []
        }
    })

    ipcMain.handle('get-current-context', async () => {
        try {
            const { stdout } = await execPromise('kubectl config current-context')
            return stdout.trim()
        } catch {
            return 'None'
        }
    })

    ipcMain.handle('get-pods', async (_event, contextName) => {
        try {
            // Use -A for all namespaces and -o json for easier parsing
            const { stdout } = await execPromise(`kubectl get pods --context ${contextName} -A -o json`)
            const data = JSON.parse(stdout)
            return { success: true, pods: data.items || [] }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('get-namespaces', async (_event, contextName) => {
        try {
            const { stdout } = await execPromise(`kubectl get namespaces --context ${contextName} -o name`)
            const namespaces = stdout.trim().split('\n').map(ns => ns.replace('namespace/', '')).filter(Boolean)
            return { success: true, namespaces }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('get-resources', async (_event, { contextName, resourceType, namespace }) => {
        try {
            const nsFlag = namespace === 'all' ? '-A' : `-n ${namespace}`
            const { stdout } = await execPromise(`kubectl get ${resourceType} --context ${contextName} ${nsFlag} -o json`)
            const data = JSON.parse(stdout)
            return { success: true, items: data.items || [] }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('delete-cluster', async (_event, name) => {
        try {
            await execPromise(`kind delete cluster --name ${name}`)
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(dist, 'index.html'))
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.whenReady().then(createWindow)
