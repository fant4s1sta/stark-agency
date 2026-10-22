import { contextBridge, ipcRenderer } from 'electron';

// Expose individual operations, never the IPC transport or Node.js APIs.
contextBridge.exposeInMainWorld('starkDesktop', Object.freeze({
  toggleFullscreen: (): Promise<boolean> => ipcRenderer.invoke('app:toggle-fullscreen'),
  onFullscreenChange: (callback: (fullscreen: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, fullscreen: boolean) => callback(fullscreen);
    ipcRenderer.on('app:fullscreen-changed', listener);
    return () => ipcRenderer.removeListener('app:fullscreen-changed', listener);
  },
  getInfo: (): Promise<{ version: string; platform: string }> => ipcRenderer.invoke('app:get-info'),
}));
