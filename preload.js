const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  getUserSettings: () => ipcRenderer.invoke('get-user-settings'),
  saveUserSettings: (settings) => ipcRenderer.invoke('save-user-settings', settings),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  readClipboard: () => ipcRenderer.invoke('read-clipboard')
});
