import { app, BrowserWindow } from 'electron';
import path from 'path';
import { startServer, stopServer } from './server';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: 'Zabeel Supermarket POS System',
    show: false, // Don't show until content is ready (prevents white flash)
  });

  // Determine if in development mode
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // FIX: In packaged app, main.js lives at dist/main/main/main.js
    // So we need to go 3 directories up to reach the app root, then into dist/renderer
    const rendererPath = path.join(__dirname, '..', '..', '..', 'dist', 'renderer', 'index.html');
    mainWindow.loadFile(rendererPath);
  }

  // Show window only when the page is fully loaded — prevents white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Electron Application Lifecycle
app.whenReady().then(() => {
  // Start the backend Express server first
  startServer();

  // Wait 300ms for Express to bind to port before Electron loads the page
  // This prevents race condition where API calls fail on startup
  setTimeout(() => {
    createWindow();
  }, 300);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
