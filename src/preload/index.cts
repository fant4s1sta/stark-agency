import { contextBridge, ipcRenderer } from 'electron';

// Expose individual operations, never the IPC transport or Node.js APIs.
contextBridge.exposeInMainWorld('starkDesktop', Object.freeze({
  getInfo: (): Promise<{ version: string; platform: string }> => ipcRenderer.invoke('app:get-info'),
}));
