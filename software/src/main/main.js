const { app, BrowserWindow, session, ipcMain, clipboard, Menu, MenuItem } = require('electron');
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
const configTemplatePath = path.join(rootDir, 'config', 'config.json.template');
const userSettingsPath = path.join(rootDir, 'config', 'user-settings.json');
const userSettingsTemplatePath = path.join(rootDir, 'config', 'user-settings.json.template');

// Sicherstellen dass Config-Dateien existieren (aus Templates kopieren)
function ensureConfigFiles() {
  if (!fs.existsSync(configPath) && fs.existsSync(configTemplatePath)) {
    console.log('Creating config.json from template...');
    fs.copyFileSync(configTemplatePath, configPath);
  }
  if (!fs.existsSync(userSettingsPath) && fs.existsSync(userSettingsTemplatePath)) {
    console.log('Creating user-settings.json from template...');
    fs.copyFileSync(userSettingsTemplatePath, userSettingsPath);
  }
}

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

let saveSettingsPromise = Promise.resolve();

async function saveUserSettings(settings) {
  // Serialize writes to prevent race conditions
  const currentSave = saveSettingsPromise.then(async () => {
    try {
      await fs.promises.writeFile(userSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('Error saving user-settings.json:', e);
      return false;
    }
  });

  // Ensure the chain continues even if one fails
  saveSettingsPromise = currentSave.catch(() => {});

  return currentSave;
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

ipcMain.handle('save-user-settings', async (event, settings) => {
  return await saveUserSettings(settings);
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

// Context Menu Handler
ipcMain.on('show-context-menu', (event, params) => {
  const menu = new Menu();

  // Helper to add item if role logic allows (simple roles work automatically on focused window)
  // For webviews, we might need to send a command back, but 'role' usually works 
  // if the webview has focus. Let's try standard roles first.

  // Cut
  menu.append(new MenuItem({
    label: 'Ausschneiden',
    role: 'cut',
    enabled: params.editFlags.canCut
  }));

  // Copy
  menu.append(new MenuItem({
    label: 'Kopieren',
    role: 'copy',
    enabled: params.editFlags.canCopy
  }));

  // Paste
  menu.append(new MenuItem({
    label: 'Einfügen',
    role: 'paste',
    // Paste is often always enabled in edit fields, but we can check if clipboard has text
    // params.editFlags.canPaste is reliable in Electron
    enabled: params.editFlags.canPaste
  }));

  menu.append(new MenuItem({ type: 'separator' }));

  // Select All
  menu.append(new MenuItem({
    label: 'Alles auswählen',
    role: 'selectAll',
    enabled: params.editFlags.canSelectAll
  }));

  // Inspect Element (Development only, optionally)
  // if (process.env.NODE_ENV === 'development') {
  //   menu.append(new MenuItem({ type: 'separator' }));
  //   menu.append(new MenuItem({
  //     label: 'Untersuchen',
  //     click: () => {
  //       // We would need the webContents of the sender. 
  //       // Since the sender is the renderer, and the event happened in a webview, 
  //       // we might not target the right one easily without more info.
  //       // Keeping it simple for now (Copy/Paste focus).
  //     }
  //   }));
  // }

  const win = BrowserWindow.fromWebContents(event.sender);
  menu.popup({ window: win, x: params.x, y: params.y });
});

app.whenReady().then(() => {
  ensureConfigFiles();
  createWindow();

  // Signal renderer that config is ready after the window has loaded its content
  if (mainWindow) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('config-ready');
    });
  }
});

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
