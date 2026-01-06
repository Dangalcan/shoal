"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const util_1 = __importDefault(require("util"));
const execPromise = util_1.default.promisify(child_process_1.exec);
process.env.DIST = path_1.default.join(__dirname, '../dist');
process.env.VITE_PUBLIC = electron_1.app.isPackaged ? process.env.DIST : path_1.default.join(process.env.DIST, '../public');
let win;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
function createWindow() {
    const dist = process.env.DIST;
    const publicDir = process.env.VITE_PUBLIC;
    if (!dist || !publicDir) {
        throw new Error('DIST or VITE_PUBLIC is undefined');
    }
    win = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        icon: path_1.default.join(publicDir, 'electron-vite.svg'),
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
        },
    });
    // IPC Handlers
    electron_1.ipcMain.handle('run-command', async (_event, command) => {
        try {
            const { stdout, stderr } = await execPromise(command);
            return { success: true, stdout, stderr };
        }
        catch (error) {
            return { success: false, error: error.message, stderr: error.stderr };
        }
    });
    electron_1.ipcMain.handle('check-tool', async (_event, tool) => {
        try {
            await execPromise(`${tool} --version`);
            return true;
        }
        catch {
            return false;
        }
    });
    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL);
    }
    else {
        win.loadFile(path_1.default.join(dist, 'index.html'));
    }
}
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
        win = null;
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
electron_1.app.whenReady().then(createWindow);
