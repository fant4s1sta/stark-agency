import { app, BrowserWindow, dialog, ipcMain, Menu, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startBackend, type Backend } from './backend.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
let backend: Backend | undefined;
let window: BrowserWindow | null = null;
let quitting = false;
let stopped = false;
const dataDirectory = () => process.env.OFFICE_DATA_DIR
  ? path.resolve(process.env.OFFICE_DATA_DIR)
  : path.join(app.getPath('userData'), 'office');

app.setName('Stark Agency');
const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else {
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore();
    window?.show(); window?.focus();
  });
  app.on('before-quit', event => {
    if (stopped) return;
    event.preventDefault();
    if (quitting) return;
    quitting = true;
    void (async () => {
      try { await backend?.stop(); }
      catch (error) { console.error('关闭后台失败', error); }
      finally { stopped = true; app.quit(); }
    })();
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => {
    if (!quitting && backend && !BrowserWindow.getAllWindows().length) void createWindow().catch(fail);
  });
  void app.whenReady().then(async () => {
    backend = await startBackend(app.getAppPath(), dataDirectory());
    backend.process.once('exit', code => {
      if (!quitting) fail(new Error(`后台服务意外退出（${code}），请重新启动应用。`));
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    await session.defaultSession.cookies.set({
      url: backend.url, name: 'stark_session', value: backend.token,
      httpOnly: true, sameSite: 'strict', path: '/',
    });
    ipcMain.handle('app:get-info', event => {
      if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || new URL(event.senderFrame.url).origin !== backend?.url) {
        throw new Error('无效的桌面调用来源');
      }
      return { version: app.getVersion(), platform: process.platform };
    });
    // Remove the native menu entirely, including the Alt-key menu on Windows/Linux.
    Menu.setApplicationMenu(null);
    await createWindow();
  }).catch(fail);
}

async function createWindow() {
  if (!backend) throw new Error('后台服务尚未启动');
  const origin = backend.url;
  const created = new BrowserWindow({
    title: 'Stark Agency', width: 1440, height: 1000, minWidth: 900, minHeight: 640,
    backgroundColor: '#f6f4ee', show: false,
    webPreferences: {
      preload: path.join(directory, '../preload/index.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: false,
    },
  });
  window = created;
  created.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const blockNavigation = (event: Electron.Event, target: string) => {
    if (new URL(target).origin !== origin) event.preventDefault();
  };
  created.webContents.on('will-navigate', blockNavigation);
  created.webContents.on('will-redirect', blockNavigation);
  created.webContents.on('will-attach-webview', event => event.preventDefault());
  created.once('ready-to-show', () => created.show());
  created.on('closed', () => { if (window === created) window = null; });
  await created.loadURL(origin);
}

function fail(error: unknown) {
  console.error(error);
  dialog.showErrorBox('Stark Agency 无法继续运行', error instanceof Error ? error.message : String(error));
  app.quit();
}
