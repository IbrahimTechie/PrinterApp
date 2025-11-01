import electron from 'electron';
import fs from 'fs';
import path from 'path';

const { app } = electron;

let LOG_DIR = null;

function ensureLogDir() {
  if (!LOG_DIR) {
    // Only call getPath if app is ready
    if (!app || !app.getPath) {
      throw new Error("Electron app is not available or not ready.");
    }
    const userDataPath = app.getPath('userData');
    LOG_DIR = path.join(userDataPath, 'logs');
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  }
}

export default function logToFile(message) {
  ensureLogDir();
  const logFile = path.join(LOG_DIR, 'printing.log');
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFile(logFile, logMessage, (err) => {
    if (err) console.error("❌ Failed to write log:", err);
  });
}