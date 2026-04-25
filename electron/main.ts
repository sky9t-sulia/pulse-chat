import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import path from 'path';
import { state } from './state';
import { initDatabase } from './database';
import { registerBuiltInTools } from './executors/register-built-in-tools';
import { registerConversationsHandlers } from './handlers/conversations-handler';
import { registerMessagesHandlers } from './handlers/messages-handler';
import { registerProvidersHandlers } from './handlers/providers-handler';
import { registerToolsHandlers } from './handlers/tools-handler';
import { registerUserHandlers } from './handlers/user-handler';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1300,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#1a1a1a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  state.mainWindow = win;

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Disable right-click context menu
  win.webContents.on('context-menu', () => {
    // No-op: blocks the default context menu
  });

  win.show();
}

// ─── Bootstrap ───────────────────────────────────────────────

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  await initDatabase();
  await registerBuiltInTools();
  createWindow();

  // Register all IPC handlers (side-effects on ipcMain)
  registerConversationsHandlers();
  registerMessagesHandlers();
  registerProvidersHandlers();
  registerToolsHandlers();
  registerUserHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
