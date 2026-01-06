"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electron', {
    runCommand: (command) => electron_1.ipcRenderer.invoke('run-command', command),
    checkTool: (tool) => electron_1.ipcRenderer.invoke('check-tool', tool)
});
