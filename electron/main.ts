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
