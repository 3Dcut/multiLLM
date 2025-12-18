const { app, BrowserWindow, session, ipcMain, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Pfade zu den Config-Dateien
const configPath = path.join(__dirname, 'config.json');
const userSettingsPath = path.join(__dirname, 'user-settings.json');

// Configs laden
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error('Error loading config.json:', e);
    return { services: [] };
  }
}

function loadUserSettings() {
  try {
    return JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
  } catch (e) {
    console.error('Error loading user-settings.json, using defaults:', e);
    return { activeServices: [], layout: 'grid' };
  }
}

function saveUserSettings(settings) {
  try {
    fs.writeFileSync(userSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving user-settings.json:', e);
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true
    },
    title: 'LLM MultiChat',
    backgroundColor: '#1a1a2e'
  });

  // Header-Manipulation: X-Frame-Options und CSP entfernen
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    
    const headersToRemove = [
      'x-frame-options',
      'X-Frame-Options',
      'content-security-policy',
      'Content-Security-Policy',
      'content-security-policy-report-only',
      'Content-Security-Policy-Report-Only'
    ];
    
    headersToRemove.forEach(header => {
      delete responseHeaders[header];
    });
    
    callback({ responseHeaders });
  });

  // User-Agent setzen
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    callback({ requestHeaders: details.requestHeaders });
  });

  mainWindow.loadFile('index.html');
  
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handler
ipcMain.handle('get-config', () => {
  return loadConfig();
});

ipcMain.handle('get-user-settings', () => {
  return loadUserSettings();
});

ipcMain.handle('save-user-settings', (event, settings) => {
  return saveUserSettings(settings);
});

// Clipboard Handler
ipcMain.handle('copy-to-clipboard', (event, text) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('read-clipboard', () => {
  return clipboard.readText();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
