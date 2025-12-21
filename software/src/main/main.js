const { app, BrowserWindow, session, ipcMain, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let currentLanguage = 'de'; // Aktuelle Sprache

// Sprach-Mapping für Accept-Language Header
const languageHeaders = {
  de: 'de-DE,de;q=0.9,en;q=0.8',
  en: 'en-US,en;q=0.9',
  nl: 'nl-NL,nl;q=0.9,en;q=0.8'
};

// Pfade zu den Config-Dateien (relativ zum Projekt-Root)
const rootDir = path.join(__dirname, '..', '..');
const configPath = path.join(rootDir, 'config', 'config.json');
const userSettingsPath = path.join(rootDir, 'config', 'user-settings.json');

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
    const settings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
    // Sprache aus Settings laden
    if (settings.language) {
      currentLanguage = settings.language;
    }
    return settings;
  } catch (e) {
    console.error('Error loading user-settings.json, using defaults:', e);
    return { activeServices: [], layout: 'grid', language: 'de' };
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
  // Settings laden um Sprache zu initialisieren
  loadUserSettings();
  
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
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

  // User-Agent und Accept-Language setzen
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    details.requestHeaders['Accept-Language'] = languageHeaders[currentLanguage] || languageHeaders['en'];
    callback({ requestHeaders: details.requestHeaders });
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));
  
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Beim Schließen Session speichern
  mainWindow.on('close', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.executeJavaScript('saveCurrentSession().catch(() => {})');
    }
  });

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

// File Handler (für History-Dateien - im Root-Verzeichnis)
ipcMain.handle('read-file', (event, filename) => {
  try {
    const filePath = path.join(rootDir, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
    return null;
  } catch (e) {
    console.error('Error reading file:', filename, e);
    return null;
  }
});

ipcMain.handle('write-file', (event, filename, data) => {
  try {
    const filePath = path.join(rootDir, filename);
    fs.writeFileSync(filePath, data, 'utf8');
    return true;
  } catch (e) {
    console.error('Error writing file:', filename, e);
    return false;
  }
});

// Sprache setzen
ipcMain.handle('set-language', (event, lang) => {
  if (languageHeaders[lang]) {
    currentLanguage = lang;
    console.log('Language changed to:', lang);
    return true;
  }
  return false;
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
