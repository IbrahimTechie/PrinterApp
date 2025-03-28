import { app } from 'electron';
import fs from 'fs';
import path from 'path';

const userDataPath = app.getPath('userData');
const LOG_DIR = path.join(userDataPath, 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export default function logToFile(message) {
  const logFile = path.join(LOG_DIR, 'printing.log');
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFile(logFile, logMessage, (err) => {
    if (err) console.error("❌ Failed to write log:", err);
  });
}
