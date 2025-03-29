import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In production, start the Express server.
if (process.env.NODE_ENV !== 'development') {
  const serverPath = path.join(__dirname, 'server', 'index.js');
  // Convert the absolute path to a file URL
  const serverUrl = pathToFileURL(serverPath).href;
  await import(serverUrl);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, "assets", "app-icon.ico"),
    webPreferences: {
      nodeIntegration: true, // consider security best practices for production
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, 'build', 'index.html'));
    // win.webContents.openDevTools();
  }
  Menu.setApplicationMenu(null);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
