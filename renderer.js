// Globale State
let config = { services: [] };
let userSettings = { activeServices: [], layout: 'grid' };
let webviews = {};
let mutedServices = new Set(); // Services die nächste Nachricht überspringen
let focusedService = null; // Aktuell fokussierter Service
let previousLayout = null; // Vorheriges Layout für Zurück-Button

// DOM Elemente
const promptInput = document.getElementById('prompt-input');
const sendButton = document.getElementById('send-button');
const pasteImageButton = document.getElementById('paste-image-button');
const refreshAllButton = document.getElementById('refresh-all');
const statusBar = document.getElementById('status-bar');
const webviewGrid = document.getElementById('webview-grid');

// Initialisierung
async function init() {
  try {
    // Configs laden
    config = await window.electronAPI.getConfig();
    userSettings = await window.electronAPI.getUserSettings();
    
    console.log('Config loaded:', config.services.length, 'services');
    console.log('User settings:', userSettings);
    
    // UI aufbauen
    buildStatusBar();
    buildWebViews();
    applyLayout(userSettings.layout);
    setupEventListeners();
    
  } catch (e) {
    console.error('Error initializing:', e);
    webviewGrid.innerHTML = '<div id="loading-message">Fehler beim Laden der Konfiguration</div>';
  }
}

// Status-Bar aufbauen
function buildStatusBar() {
  statusBar.innerHTML = '';
  
  config.services.forEach(service => {
    const isActive = userSettings.activeServices.includes(service.id);
    
    const statusItem = document.createElement('div');
    statusItem.className = `status-item ${isActive ? '' : 'disabled'}`;
    statusItem.dataset.service = service.id;
    
    statusItem.innerHTML = `
      <label class="toggle-switch">
        <input type="checkbox" class="service-toggle" data-service="${service.id}" ${isActive ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
      <span class="status-dot" style="background: ${isActive ? service.color : ''}"></span>
      <span>${service.name}</span>
    `;
    
    statusBar.appendChild(statusItem);
  });
}

// WebViews aufbauen
function buildWebViews() {
  webviewGrid.innerHTML = '';
  webviews = {};
  
  config.services.forEach(service => {
    const isActive = userSettings.activeServices.includes(service.id);
    
    const container = document.createElement('div');
    container.className = `webview-container ${isActive ? '' : 'hidden'}`;
    container.id = `${service.id}-container`;
    container.dataset.service = service.id; // Für Overlay-Zuordnung
    
    container.innerHTML = `
      <div class="webview-header" style="border-left: 3px solid ${service.color}">
        <span class="service-name">${service.name}</span>
        <div class="header-buttons">
          <button class="mute-btn" data-service="${service.id}" title="Nächste Nachricht überspringen">🔔</button>
          <button class="focus-btn" data-service="${service.id}" title="Nur dieses Fenster anzeigen">🔍</button>
          <button class="copy-response-btn" data-service="${service.id}" title="Letzte Antwort kopieren">📋</button>
          <button class="compare-btn" data-service="${service.id}" title="Andere Antworten hier vergleichen lassen">⚖️</button>
          <button class="reload-btn" data-service="${service.id}" title="Neu laden">↻</button>
        </div>
      </div>
      <webview 
        id="${service.id}-view"
        src="${service.url}"
        partition="persist:${service.id}"
        allowpopups
      ></webview>
    `;
    
    webviewGrid.appendChild(container);
    
    // WebView referenzieren
    const webview = container.querySelector('webview');
    webviews[service.id] = webview;
    
    // WebView Events
    webview.addEventListener('did-start-loading', () => updateStatus(service.id, 'loading'));
    webview.addEventListener('did-finish-load', () => updateStatus(service.id, 'ready'));
    webview.addEventListener('did-fail-load', () => updateStatus(service.id, 'error'));
    webview.addEventListener('console-message', (e) => console.log(`[${service.id}]`, e.message));
  });
  
  updateGridCount();
}

// Grid-Count für CSS aktualisieren
function updateGridCount() {
  const activeCount = userSettings.activeServices.length;
  
  // Entferne alte count-Klassen
  webviewGrid.className = webviewGrid.className.replace(/count-\d+/g, '').trim();
  
  // Füge neue count-Klasse hinzu
  webviewGrid.classList.add(`count-${activeCount}`);
}

// Layout anwenden
function applyLayout(layout) {
  webviewGrid.classList.remove('layout-grid', 'layout-horizontal', 'layout-vertical');
  webviewGrid.classList.add(`layout-${layout}`);
  
  // Button-Status aktualisieren
  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.layout === layout);
  });
  
  userSettings.layout = layout;
}

// Status aktualisieren
function updateStatus(serviceId, status) {
  const statusItem = document.querySelector(`.status-item[data-service="${serviceId}"]`);
  if (statusItem && userSettings.activeServices.includes(serviceId)) {
    statusItem.classList.remove('loading', 'ready', 'error');
    statusItem.classList.add(status);
  }
}

// Service aktivieren/deaktivieren
function toggleService(serviceId, enabled) {
  const container = document.getElementById(`${serviceId}-container`);
  const statusItem = document.querySelector(`.status-item[data-service="${serviceId}"]`);
  
  if (enabled) {
    if (!userSettings.activeServices.includes(serviceId)) {
      userSettings.activeServices.push(serviceId);
    }
    container.classList.remove('hidden');
    statusItem.classList.remove('disabled');
  } else {
    userSettings.activeServices = userSettings.activeServices.filter(id => id !== serviceId);
    container.classList.add('hidden');
    statusItem.classList.add('disabled');
  }
  
  updateGridCount();
  saveSettings();
  
  console.log(`[${serviceId}] ${enabled ? 'Aktiviert' : 'Deaktiviert'}`);
}

// Einstellungen speichern
async function saveSettings() {
  try {
    await window.electronAPI.saveUserSettings(userSettings);
    console.log('Settings saved');
  } catch (e) {
    console.error('Error saving settings:', e);
  }
}

// Injection Script erstellen
function createInjectionScript(service, text) {
  const escapedText = text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
  
  return `
    (async function() {
      const text = \`${escapedText}\`;
      const inputSelectors = ${JSON.stringify(service.inputSelectors)};
      const submitSelectors = ${JSON.stringify(service.submitSelectors)};
      const editorType = '${service.editorType || 'default'}';
      
      console.log('[${service.id}] Starting injection...');
      
      // Element finden
      function findElement(selectors) {
        for (const selector of selectors) {
          try {
            const el = document.querySelector(selector);
            if (el) {
              console.log('[${service.id}] Found with selector:', selector);
              return el;
            }
          } catch (e) {}
        }
        return null;
      }
      
      // Text einfügen
      async function insertText(element, text) {
        element.focus();
        await new Promise(r => setTimeout(r, 100));
        
        // Quill Editor (Gemini)
        if (editorType === 'quill' || element.classList.contains('ql-editor')) {
          console.log('[${service.id}] Using Quill-compatible insertion');
          document.execCommand('selectAll', false, null);
          document.execCommand('delete', false, null);
          await new Promise(r => setTimeout(r, 50));
          document.execCommand('insertText', false, text);
          element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          return true;
        }
        
        // ProseMirror (Claude, Mistral)
        if (editorType === 'prosemirror' || element.classList.contains('ProseMirror')) {
          console.log('[${service.id}] Using ProseMirror insertion');
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(element);
          selection.removeAllRanges();
          selection.addRange(range);
          document.execCommand('delete', false, null);
          await new Promise(r => setTimeout(r, 50));
          document.execCommand('insertText', false, text);
          element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          return true;
        }
        
        // Lexical Editor (Perplexity)
        if (editorType === 'lexical' || element.hasAttribute('data-lexical-editor')) {
          console.log('[${service.id}] Using Lexical insertion');
          element.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('delete', false, null);
          await new Promise(r => setTimeout(r, 50));
          document.execCommand('insertText', false, text);
          element.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
        
        // Textarea/Input
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
          element.value = text;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[${service.id}] Set textarea value');
          return true;
        }
        
        // Generic contenteditable (Copilot, etc.)
        console.log('[${service.id}] Using generic contenteditable insertion');
        element.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        await new Promise(r => setTimeout(r, 50));
        document.execCommand('insertText', false, text);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      
      // Input finden
      let inputEl = findElement(inputSelectors);
      if (!inputEl) {
        await new Promise(r => setTimeout(r, 1000));
        inputEl = findElement(inputSelectors);
      }
      
      if (!inputEl) {
        console.error('[${service.id}] Input not found!');
        return { success: false, error: 'Input not found' };
      }
      
      // Text einfügen
      await insertText(inputEl, text);
      await new Promise(r => setTimeout(r, 500));
      
      // Submit Button finden und klicken
      let submitBtn = null;
      for (let i = 0; i < 10; i++) {
        submitBtn = findElement(submitSelectors);
        if (submitBtn && !submitBtn.disabled) break;
        await new Promise(r => setTimeout(r, 200));
        submitBtn = null;
      }
      
      if (submitBtn && !submitBtn.disabled) {
        submitBtn.click();
        console.log('[${service.id}] Clicked submit');
        return { success: true, method: 'button' };
      }
      
      // Fallback: Enter
      console.log('[${service.id}] Trying Enter key');
      inputEl.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true
      }));
      
      return { success: true, method: 'enter' };
    })();
  `;
}

// An alle aktiven Services senden
async function sendToAll() {
  let text = promptInput.value.trim();
  
  // Fallback: Wenn kein Text, aber evtl. ein Bild eingefügt wurde, "." als Platzhalter
  if (!text) {
    text = '.';
    console.log('No text entered, using fallback "." for services that require text input');
  }
  
  // Aktive Services ohne gemutete
  const activeNonMuted = userSettings.activeServices.filter(id => !mutedServices.has(id));
  
  if (activeNonMuted.length === 0) {
    alert('Mindestens ein Service muss aktiviert sein (alle sind stummgeschaltet)!');
    return;
  }
  
  console.log('Sending to active services:', text);
  console.log('Muted services (skipping):', [...mutedServices]);
  
  // Vote zurücksetzen bei neuer Nachricht
  resetVotes();
  
  sendButton.disabled = true;
  sendButton.innerHTML = '<span>⏳</span>';
  
  const promises = config.services
    .filter(service => activeNonMuted.includes(service.id))
    .map(async (service) => {
      try {
        updateStatus(service.id, 'loading');
        const script = createInjectionScript(service, text);
        const result = await webviews[service.id].executeJavaScript(script);
        console.log(`[${service.id}] Result:`, result);
        updateStatus(service.id, result?.success ? 'ready' : 'error');
        return { service: service.id, ...result };
      } catch (error) {
        console.error(`Error sending to ${service.id}:`, error);
        updateStatus(service.id, 'error');
        return { service: service.id, success: false, error: error.message };
      }
    });
  
  const results = await Promise.all(promises);
  console.log('Send results:', results);
  
  // Mutes nach dem Senden aufheben
  clearMutedServices();
  
  sendButton.disabled = false;
  sendButton.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    </svg>
  `;
  
  promptInput.value = '';
  promptInput.focus();
}

// Script um Text anzufügen (ohne bestehendes zu löschen) - für Fallback "." bei Bildern
function createAppendTextScript(service, text) {
  return `
    (async function() {
      const inputSelectors = ${JSON.stringify(service.inputSelectors)};
      
      function findElement(selectors) {
        for (const selector of selectors) {
          try {
            const el = document.querySelector(selector);
            if (el) return el;
          } catch (e) {}
        }
        return null;
      }
      
      const element = findElement(inputSelectors);
      if (!element) return { success: false, error: 'Input not found' };
      
      element.focus();
      
      // Cursor ans Ende setzen
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        element.value += '${text}';
        element.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        // contenteditable
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false); // false = ans Ende
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('insertText', false, '${text}');
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      return { success: true };
    })();
  `;
}

// Event Listeners
function setupEventListeners() {
  // Send Button
  sendButton.addEventListener('click', sendToAll);
  
  // Paste Image Button
  pasteImageButton.addEventListener('click', pasteImageToAll);
  
  // Strg+Enter und Strg+Shift+V
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      sendToAll();
    }
  });
  
  // Global Keyboard Shortcut für Bild-Paste
  document.addEventListener('keydown', (e) => {
    if (e.key === 'V' && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      pasteImageToAll();
    }
  });
  
  // Service Toggles
  statusBar.addEventListener('change', (e) => {
    if (e.target.classList.contains('service-toggle')) {
      toggleService(e.target.dataset.service, e.target.checked);
    }
  });
  
  // Reload, Copy und Compare Buttons
  webviewGrid.addEventListener('click', (e) => {
    const serviceId = e.target.dataset.service;
    
    // Debug
    console.log('Click on:', e.target.tagName, e.target.className, 'serviceId:', serviceId);
    
    if (e.target.classList.contains('reload-btn')) {
      webviews[serviceId]?.reload();
    }
    
    if (e.target.classList.contains('copy-response-btn')) {
      copyResponse(serviceId);
    }
    
    if (e.target.classList.contains('compare-btn')) {
      resetVotes(); // Vote zurücksetzen bei Vergleich
      crossCompare(serviceId);
    }
    
    if (e.target.classList.contains('mute-btn')) {
      toggleMute(serviceId);
    }
    
    // Focus-Button: unfocus-btn hat Priorität (Button hat beide Klassen wenn fokussiert)
    if (e.target.classList.contains('unfocus-btn')) {
      exitFocus();
    } else if (e.target.classList.contains('focus-btn')) {
      toggleFocus(serviceId);
    }
  });
  
  // Refresh All - Neue Session (URL neu laden)
  refreshAllButton.addEventListener('click', () => {
    resetVotes(); // Vote zurücksetzen
    userSettings.activeServices.forEach(serviceId => {
      const service = config.services.find(s => s.id === serviceId);
      if (service && webviews[serviceId]) {
        webviews[serviceId].loadURL(service.url);
      }
    });
  });
  
  // Compare All Button
  document.getElementById('compare-all-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('compare-all-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Sammle...';
    
    resetVotes(); // Vote zurücksetzen bei Vergleich
    await compareAll();
    
    btn.disabled = false;
    btn.textContent = '⚖️ Vergleichen';
  });
  
  // Vote Check Button
  document.getElementById('vote-check-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('vote-check-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Prüfe...';
    
    await updateVoteDisplay();
    
    // Overlay kurz anzeigen und ausfaden
    showVoteOverlays(true);
    setTimeout(() => fadeOutOverlays(), 1000);
    
    btn.disabled = false;
    btn.textContent = '🗳️ Vote';
  });
  
  // Layout Buttons
  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyLayout(btn.dataset.layout);
      saveSettings();
    });
  });
}

// Bild aus Zwischenablage in alle aktiven Services einfügen
async function pasteImageToAll() {
  if (userSettings.activeServices.length === 0) {
    alert('Mindestens ein Service muss aktiviert sein!');
    return;
  }
  
  try {
    // Zwischenablage auslesen
    const clipboardItems = await navigator.clipboard.read();
    let imageBlob = null;
    
    for (const item of clipboardItems) {
      // Nach Bild-Typen suchen
      const imageType = item.types.find(type => type.startsWith('image/'));
      if (imageType) {
        imageBlob = await item.getType(imageType);
        break;
      }
    }
    
    if (!imageBlob) {
      alert('Kein Bild in der Zwischenablage gefunden!');
      return;
    }
    
    console.log('Found image in clipboard:', imageBlob.type, imageBlob.size, 'bytes');
    
    // Button visuell ändern während des Einfügens
    pasteImageButton.disabled = true;
    pasteImageButton.classList.add('has-image');
    
    // Bild als Base64 konvertieren für Transfer
    const reader = new FileReader();
    const base64Promise = new Promise((resolve) => {
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(imageBlob);
    });
    const base64Data = await base64Promise;
    
    // In alle aktiven WebViews einfügen
    const promises = config.services
      .filter(service => userSettings.activeServices.includes(service.id))
      .map(async (service) => {
        try {
          updateStatus(service.id, 'loading');
          const script = createPasteImageScript(service, base64Data, imageBlob.type);
          const result = await webviews[service.id].executeJavaScript(script);
          console.log(`[${service.id}] Image paste result:`, result);
          
          // Mistral braucht natives Paste (Bild ist bereits in System-Zwischenablage)
          if (result?.needsNativePaste) {
            console.log(`[${service.id}] Setting focus and using native paste...`);
            
            // Erst WebView selbst fokussieren
            webviews[service.id].focus();
            
            // Dann Fokus auf Textbox setzen und warten bis focused-Klasse da ist
            const focusScript = `
              (async function() {
                const inputSelectors = ${JSON.stringify(service.inputSelectors)};
                for (const selector of inputSelectors) {
                  try {
                    const el = document.querySelector(selector);
                    if (el) {
                      // Klick simulieren um Fokus zu setzen
                      el.click();
                      el.focus();
                      
                      // Warten bis ProseMirror-focused Klasse erscheint (max 500ms)
                      for (let i = 0; i < 10; i++) {
                        if (el.classList.contains('ProseMirror-focused')) {
                          console.log('[Mistral] Focus confirmed after ' + (i * 50) + 'ms');
                          return true;
                        }
                        await new Promise(r => setTimeout(r, 50));
                      }
                      console.log('[Mistral] Focus class not found, proceeding anyway');
                      return true;
                    }
                  } catch (e) {
                    console.error('[Mistral] Focus error:', e);
                  }
                }
                return false;
              })();
            `;
            const focusResult = await webviews[service.id].executeJavaScript(focusScript);
            console.log(`[${service.id}] Focus result:`, focusResult);
            
            // Kurz warten
            await new Promise(r => setTimeout(r, 50));
            
            // Dann natives paste
            webviews[service.id].paste();
            updateStatus(service.id, 'ready');
            return { service: service.id, success: true, method: 'nativePaste' };
          }
          
          updateStatus(service.id, result?.success ? 'ready' : 'error');
          return { service: service.id, ...result };
        } catch (error) {
          console.error(`Error pasting to ${service.id}:`, error);
          updateStatus(service.id, 'error');
          return { service: service.id, success: false, error: error.message };
        }
      });
    
    const results = await Promise.all(promises);
    console.log('Paste results:', results);
    
    // Button zurücksetzen
    pasteImageButton.disabled = false;
    setTimeout(() => pasteImageButton.classList.remove('has-image'), 1000);
    
  } catch (e) {
    console.error('Clipboard access error:', e);
    alert('Fehler beim Zugriff auf die Zwischenablage: ' + e.message);
    pasteImageButton.disabled = false;
  }
}

// Script für Bild-Einfügen erstellen
function createPasteImageScript(service, base64Data, mimeType) {
  return `
    (async function() {
      console.log('[${service.id}] Starting image paste...');
      
      const inputSelectors = ${JSON.stringify(service.inputSelectors)};
      const editorType = '${service.editorType || 'default'}';
      const serviceId = '${service.id}';
      
      // Input finden
      function findElement(selectors) {
        for (const selector of selectors) {
          try {
            const el = document.querySelector(selector);
            if (el) return el;
          } catch (e) {}
        }
        return null;
      }
      
      let inputEl = findElement(inputSelectors);
      if (!inputEl) {
        await new Promise(r => setTimeout(r, 500));
        inputEl = findElement(inputSelectors);
      }
      
      if (!inputEl) {
        console.error('[${service.id}] Input not found for image paste');
        return { success: false, error: 'Input not found' };
      }
      
      try {
        // Base64 zu Blob konvertieren
        const base64 = '${base64Data}';
        const byteString = atob(base64.split(',')[1]);
        const mimeType = '${mimeType}';
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeType });
        const file = new File([blob], 'image.' + mimeType.split('/')[1], { type: mimeType });
        
        // Focus auf Input
        inputEl.focus();
        await new Promise(r => setTimeout(r, 100));
        
        // Mistral: Braucht natives Paste via webview.paste()
        if (serviceId === 'mistral') {
          console.log('[${service.id}] Mistral needs native paste');
          return { success: false, needsNativePaste: true };
        }
        
        // ChatGPT: File-Input nutzen
        if (serviceId === 'chatgpt') {
          console.log('[${service.id}] Looking for file input...');
          
          // Versteckten File-Input suchen
          const fileInput = document.querySelector('input[type="file"][accept*="image"]') 
                         || document.querySelector('input[type="file"]');
          
          if (fileInput) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[${service.id}] Used file input');
            return { success: true, method: 'fileInput' };
          } else {
            console.log('[${service.id}] No file input found, trying paste event');
          }
        }
        
        // Claude: Braucht speziellen Upload-Button Ansatz
        if (serviceId === 'claude') {
          console.log('[${service.id}] Claude detected, trying file input method');
          
          // Suche nach verstecktem File-Input
          const fileInput = document.querySelector('input[type="file"]');
          if (fileInput) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[${service.id}] Used file input');
            return { success: true, method: 'fileInput' };
          }
          
          // Fallback: Drop auf Container
          const dropZone = inputEl.closest('fieldset') || inputEl.closest('form') || inputEl.parentElement;
          if (dropZone) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            
            const dropEvent = new DragEvent('drop', {
              bubbles: true,
              cancelable: true,
              dataTransfer: dataTransfer
            });
            dropZone.dispatchEvent(dropEvent);
            console.log('[${service.id}] Used drop on container');
            return { success: true, method: 'drop' };
          }
          
          return { success: false, error: 'No upload method found for Claude' };
        }
        
        // Für andere Editoren (Copilot, Gemini, Perplexity): Paste-Event
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dataTransfer
        });
        
        inputEl.dispatchEvent(pasteEvent);
        console.log('[${service.id}] Paste event dispatched');
        
        return { success: true, method: 'paste' };
        
      } catch (e) {
        console.error('[${service.id}] Image paste failed:', e);
        return { success: false, error: e.message };
      }
    })();
  `;
}

// Debug-Funktionen
window.debugSelectors = async (serviceId) => {
  const webview = webviews[serviceId];
  if (!webview) {
    console.log('Service not found:', serviceId);
    return;
  }
  
  const script = `
    (function() {
      const inputs = document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]');
      return Array.from(inputs).map((el, i) => ({
        index: i,
        tag: el.tagName,
        id: el.id,
        class: el.className,
        placeholder: el.placeholder || el.getAttribute('data-placeholder'),
        ariaLabel: el.getAttribute('aria-label')
      }));
    })();
  `;
  
  const result = await webview.executeJavaScript(script);
  console.log(`[${serviceId}] Available inputs:`, result);
  return result;
};

window.webviews = webviews;
window.config = config;
window.userSettings = userSettings;

// ============================================
// RESPONSE READING & COMPARISON FEATURES
// ============================================

// Letzte Antwort eines Services auslesen
async function getLastResponse(serviceId) {
  const service = config.services.find(s => s.id === serviceId);
  if (!service || !service.responseSelectors) {
    console.error(`[${serviceId}] No response selectors configured`);
    return null;
  }
  
  const webview = webviews[serviceId];
  if (!webview) return null;
  
  const script = `
    (function() {
      const selectors = ${JSON.stringify(service.responseSelectors)};
      
      // Alle Response-Elemente finden
      let allResponses = [];
      for (const selector of selectors) {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            allResponses = Array.from(elements);
            break;
          }
        } catch (e) {}
      }
      
      if (allResponses.length === 0) {
        return { success: false, error: 'No responses found' };
      }
      
      // Letzte Antwort nehmen
      const lastResponse = allResponses[allResponses.length - 1];
      const text = lastResponse.innerText || lastResponse.textContent || '';
      
      return { 
        success: true, 
        text: text.trim(),
        count: allResponses.length
      };
    })();
  `;
  
  try {
    const result = await webview.executeJavaScript(script);
    console.log(`[${serviceId}] Response:`, result);
    return result;
  } catch (e) {
    console.error(`[${serviceId}] Error getting response:`, e);
    return { success: false, error: e.message };
  }
}

// Alle Antworten der aktiven Services sammeln
async function getAllResponses() {
  const responses = {};
  
  for (const serviceId of userSettings.activeServices) {
    const result = await getLastResponse(serviceId);
    if (result?.success && result.text) {
      const service = config.services.find(s => s.id === serviceId);
      responses[serviceId] = {
        name: service?.name || serviceId,
        text: result.text
      };
    }
  }
  
  return responses;
}

// Antwort in Zwischenablage kopieren
async function copyResponse(serviceId) {
  const result = await getLastResponse(serviceId);
  
  if (!result?.success || !result.text) {
    alert(`Keine Antwort von ${serviceId} gefunden.`);
    return;
  }
  
  try {
    // Electron clipboard über IPC
    await window.electronAPI.copyToClipboard(result.text);
    
    // Visuelles Feedback
    const btn = document.querySelector(`.copy-response-btn[data-service="${serviceId}"]`);
    if (btn) {
      btn.textContent = '✅';
      setTimeout(() => btn.textContent = '📋', 1000);
    }
    
    console.log(`[${serviceId}] Response copied (${result.text.length} chars)`);
  } catch (e) {
    console.error('Copy failed:', e);
    alert('Kopieren fehlgeschlagen: ' + e.message);
  }
}

// Kreuzvergleich: Andere Antworten in einen Service einfügen
async function crossCompare(targetServiceId) {
  const responses = await getAllResponses();
  
  // Andere Services außer dem Ziel
  const otherResponses = Object.entries(responses)
    .filter(([id]) => id !== targetServiceId);
  
  if (otherResponses.length === 0) {
    alert('Keine Antworten von anderen Services gefunden.');
    return;
  }
  
  // Vergleichs-Prompt aus Config bauen
  const prompts = config.prompts || {};
  let comparePrompt = prompts.compareIntro || 'Vergleiche und bewerte die folgenden Antworten verschiedener KIs:\n\n';
  
  otherResponses.forEach(([id, data]) => {
    const separator = (prompts.answerSeparator || '--- {name} ---\n{text}\n\n')
      .replace('{name}', data.name)
      .replace('{text}', data.text);
    comparePrompt += separator;
  });
  
  comparePrompt += prompts.compareOutro || '---\n\nBewerte anhand der Argumente, welche Antwort am besten/richtigsten ist. Begründe deine Einschätzung.';
  
  // In Ziel-Service einfügen
  const service = config.services.find(s => s.id === targetServiceId);
  if (!service) return;
  
  const script = createInjectionScript(service, comparePrompt);
  
  try {
    await webviews[targetServiceId].executeJavaScript(script);
    console.log(`[${targetServiceId}] Cross-compare prompt injected`);
    
    // Visuelles Feedback
    const btn = document.querySelector(`.compare-btn[data-service="${targetServiceId}"]`);
    if (btn) {
      btn.textContent = '✅';
      setTimeout(() => btn.textContent = '⚖️', 1000);
    }
  } catch (e) {
    console.error(`[${targetServiceId}] Cross-compare failed:`, e);
  }
}

// Alle Services vergleichen lassen
async function compareAll() {
  const responses = await getAllResponses();
  const responseList = Object.entries(responses);
  
  if (responseList.length < 2) {
    alert('Mindestens 2 Services müssen Antworten haben.');
    return;
  }
  
  // Vergleichs-Prompt aus Config bauen
  const prompts = config.prompts || {};
  let comparePrompt = prompts.compareIntro || 'Vergleiche und bewerte die folgenden Antworten verschiedener KIs:\n\n';
  
  responseList.forEach(([id, data]) => {
    const separator = (prompts.answerSeparator || '--- {name} ---\n{text}\n\n')
      .replace('{name}', data.name)
      .replace('{text}', data.text);
    comparePrompt += separator;
  });
  
  comparePrompt += prompts.compareOutro || '---\n\nBewerte anhand der Argumente, welche Antwort am besten/richtigsten ist. Begründe deine Einschätzung.';
  
  // In ALLE aktiven Services einfügen
  for (const serviceId of userSettings.activeServices) {
    const service = config.services.find(s => s.id === serviceId);
    if (!service) continue;
    
    const script = createInjectionScript(service, comparePrompt);
    
    try {
      await webviews[serviceId].executeJavaScript(script);
      console.log(`[${serviceId}] Compare-all prompt injected`);
    } catch (e) {
      console.error(`[${serviceId}] Compare-all failed:`, e);
    }
  }
}

// Ja/Nein Abstimmung auswerten
async function evaluateYesNo() {
  const responses = await getAllResponses();
  const votes = { ja: [], nein: [], unklar: [] };
  const strategy = config.voteStrategy || 'weighted';
  
  for (const [serviceId, data] of Object.entries(responses)) {
    const text = data.text;
    const voteEntry = { id: serviceId, name: data.name };
    
    let result = detectVote(text, strategy);
    
    if (result === 'ja') {
      votes.ja.push(voteEntry);
    } else if (result === 'nein') {
      votes.nein.push(voteEntry);
    } else {
      votes.unklar.push(voteEntry);
    }
  }
  
  return votes;
}

// Vote-Erkennung mit verschiedenen Strategien
function detectVote(text, strategy) {
  // Text vorbereiten (Emojis/Symbole am Anfang entfernen)
  const cleanedText = VotePatterns.cleanText(text);
  const lowerText = cleanedText.toLowerCase();
  
  // ZUERST: Meta-Aussagen erkennen (Rankings, Vergleiche)
  if (VotePatterns.isMeta(lowerText)) {
    return 'unklar';
  }
  
  // DANN: Rückfragen erkennen
  if (VotePatterns.isUnclear(lowerText)) {
    return 'unklar';
  }
  
  // Strategie 1: Feste Muster
  if (strategy === 'pattern') {
    return detectByPattern(lowerText);
  }
  
  // Strategie 2: Erstes Ja/Nein gewinnt
  if (strategy === 'first') {
    return detectByFirst(lowerText);
  }
  
  // Strategie 3: Zählen - Mehrheit gewinnt
  if (strategy === 'count') {
    return detectByCount(lowerText);
  }
  
  // Strategie 4: Gewichtet (Default)
  if (strategy === 'weighted') {
    // Erst Muster probieren
    const patternResult = detectByPattern(lowerText);
    if (patternResult !== 'unklar') {
      return patternResult;
    }
    // Dann gewichtete Analyse
    return detectByWeighted(lowerText);
  }
  
  return 'unklar';
}

// Erkennt Meta-Aussagen über Ja/Nein (keine echten Antworten)
function isMetaStatement(text) {
  const start = text.substring(0, 300).toLowerCase();
  
  // Einfache Patterns die auf Meta-Aussagen hinweisen
  const metaPatterns = [
    /„ja"\s*(oder|und|\/)\s*„nein"/i,
    /"ja"\s*(oder|und|\/)\s*"nein"/i,
    /\bja\s*(oder|und)\s*nein\b/i,
    /\bja\s*\/\s*nein\b/i,
    /\byes\s*(or|and|\/)\s*no\b/i,
  ];
  
  return metaPatterns.some(pattern => pattern.test(start));
}

// Strategie: Feste Muster aus VotePatterns
function detectByPattern(text) {
  const start = text.substring(0, 200).toLowerCase();
  
  // Patterns aus externer Datei nutzen
  const isJa = VotePatterns.jaPatterns.some(p => p.test(start));
  const isNein = VotePatterns.neinPatterns.some(p => p.test(start));
  
  if (isJa && !isNein) return 'ja';
  if (isNein && !isJa) return 'nein';
  return 'unklar';
}

// Strategie: Erstes Wort gewinnt
function detectByFirst(text) {
  const start = text.substring(0, 150).toLowerCase();
  
  // Suche nach Ja/Nein am Satzanfang
  const jaMatch = start.match(/(?:^|[.!?]\s*)(ja|yes|jawohl|genau|absolut|definitiv)[\s\.,!\-–:;,\n\r]/i);
  const neinMatch = start.match(/(?:^|[.!?]\s*)(nein|no|nicht|keineswegs|niemals)[\s\.,!\-–:;,\n\r]/i);
  
  if (!jaMatch && !neinMatch) return 'unklar';
  if (jaMatch && !neinMatch) return 'ja';
  if (neinMatch && !jaMatch) return 'nein';
  
  // Beide gefunden - welches kommt zuerst?
  if (jaMatch.index < neinMatch.index) return 'ja';
  if (neinMatch.index < jaMatch.index) return 'nein';
  return 'unklar';
}

// Strategie: Zählen
function detectByCount(text) {
  const start = text.substring(0, 200).toLowerCase();
  
  const jaMatches = start.match(/\b(ja|yes|jawohl)\b/gi) || [];
  const neinMatches = start.match(/\b(nein|no|nicht)\b/gi) || [];
  
  const jaCount = jaMatches.length;
  const neinCount = neinMatches.length;
  
  if (jaCount === 0 && neinCount === 0) return 'unklar';
  if (jaCount > neinCount) return 'ja';
  if (neinCount > jaCount) return 'nein';
  return 'unklar';
}

// Strategie: Gewichtet
function detectByWeighted(text) {
  const start = text.substring(0, 250).toLowerCase();
  
  let jaScore = 0;
  let neinScore = 0;
  
  // Wörter aus VotePatterns
  const jaWordsRegex = new RegExp('\\b(' + VotePatterns.jaWords.join('|') + ')\\b', 'gi');
  const neinWordsRegex = new RegExp('\\b(' + VotePatterns.neinWords.join('|') + ')\\b', 'gi');
  
  let match;
  
  // Ja-Wörter gewichten
  while ((match = jaWordsRegex.exec(start)) !== null) {
    jaScore += getPositionWeight(match.index, start);
  }
  
  // Nein-Wörter gewichten
  while ((match = neinWordsRegex.exec(start)) !== null) {
    neinScore += getPositionWeight(match.index, start);
  }
  
  // Mindestens 5 Punkte für klares Ergebnis
  if (jaScore === 0 && neinScore === 0) return 'unklar';
  if (jaScore >= 5 && jaScore > neinScore) return 'ja';
  if (neinScore >= 5 && neinScore > jaScore) return 'nein';
  
  return 'unklar';
}

// Gewicht basierend auf Position
function getPositionWeight(position, text) {
  const beforeText = text.substring(Math.max(0, position - 5), position);
  const isAfterSentenceEnd = /[.!?\n]\s*$/.test(beforeText) || position < 3;
  
  if (isAfterSentenceEnd && position < 50) {
    return 10; // Satzanfang in den ersten 50 Zeichen
  }
  if (position < 50) {
    return 5; // Erste 50 Zeichen
  }
  if (position < 150) {
    return 2; // Zeichen 50-150
  }
  return 1; // Rest
}

// Globale Variable für letztes Vote-Ergebnis
let lastVotes = null;

// Vote zurücksetzen
function resetVotes() {
  lastVotes = null;
  const voteDisplay = document.getElementById('vote-display');
  if (voteDisplay) {
    voteDisplay.innerHTML = '';
  }
  // Overlays entfernen
  document.querySelectorAll('.vote-overlay').forEach(el => el.remove());
}

// Overlays mit Fade-Out entfernen
function fadeOutOverlays() {
  const overlays = document.querySelectorAll('.vote-overlay');
  overlays.forEach(overlay => {
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 500);
  });
}

// Overlays ein-/ausblenden
function showVoteOverlays(show) {
  if (!lastVotes) return;
  
  // Alle Overlays entfernen
  document.querySelectorAll('.vote-overlay').forEach(el => el.remove());
  
  if (!show) return;
  
  // Overlays für jeden Service erstellen
  const addOverlay = (entries, colorClass) => {
    entries.forEach(entry => {
      const container = document.querySelector(`.webview-container[data-service="${entry.id}"]`);
      if (container) {
        const overlay = document.createElement('div');
        overlay.className = `vote-overlay ${colorClass}`;
        container.appendChild(overlay);
      }
    });
  };
  
  addOverlay(lastVotes.ja, 'vote-overlay-yes');
  addOverlay(lastVotes.nein, 'vote-overlay-no');
  addOverlay(lastVotes.unklar, 'vote-overlay-unclear');
}

// Vote-Anzeige aktualisieren mit Hover-Overlays
async function updateVoteDisplay() {
  const votes = await evaluateYesNo();
  lastVotes = votes; // Global speichern für Overlay
  
  const voteDisplay = document.getElementById('vote-display');
  
  if (!voteDisplay) return;
  
  const total = votes.ja.length + votes.nein.length + votes.unklar.length;
  if (total === 0) {
    voteDisplay.innerHTML = '<span class="vote-neutral">Keine Antworten erkannt</span>';
    return;
  }
  
  // Namen für Tooltips
  const jaNames = votes.ja.map(v => v.name).join(', ');
  const neinNames = votes.nein.map(v => v.name).join(', ');
  const unklarNames = votes.unklar.map(v => v.name).join(', ');
  
  let html = '<div class="vote-container">';
  
  // Kompakte Zahlen-Anzeige
  html += '<div class="vote-counts">';
  html += `<span class="vote-count vote-yes" title="${jaNames}">Ja: ${votes.ja.length}</span>`;
  html += `<span class="vote-count vote-no" title="${neinNames}">Nein: ${votes.nein.length}</span>`;
  if (votes.unklar.length > 0) {
    html += `<span class="vote-count vote-unclear" title="${unklarNames}">?: ${votes.unklar.length}</span>`;
  }
  html += '</div>';
  
  // Mehrheit bestimmen mit farbiger Anzeige
  html += '<div class="vote-result-container">';
  if (votes.ja.length > votes.nein.length) {
    html += '<span class="vote-result vote-result-yes">MEHRHEIT: JA</span>';
  } else if (votes.nein.length > votes.ja.length) {
    html += '<span class="vote-result vote-result-no">MEHRHEIT: NEIN</span>';
  } else if (votes.ja.length === votes.nein.length && votes.ja.length > 0) {
    html += '<span class="vote-result vote-result-tie">UNENTSCHIEDEN</span>';
  } else {
    html += '<span class="vote-result vote-result-unclear">UNKLAR</span>';
  }
  html += '</div>';
  
  html += '</div>';
  
  voteDisplay.innerHTML = html;
  
  // Hover-Events für Overlay
  voteDisplay.addEventListener('mouseenter', () => showVoteOverlays(true));
  voteDisplay.addEventListener('mouseleave', () => showVoteOverlays(false));
}

// === MUTE FUNKTIONEN ===

function toggleMute(serviceId) {
  const btn = document.querySelector(`.mute-btn[data-service="${serviceId}"]`);
  const container = document.getElementById(`${serviceId}-container`);
  
  if (mutedServices.has(serviceId)) {
    // Unmute
    mutedServices.delete(serviceId);
    btn.textContent = '🔔';
    btn.title = 'Nächste Nachricht überspringen';
    container.classList.remove('muted');
  } else {
    // Mute
    mutedServices.add(serviceId);
    btn.textContent = '🔕';
    btn.title = 'Wird übersprungen (klicken zum Aufheben)';
    container.classList.add('muted');
  }
}

function clearMutedServices() {
  // Nach dem Senden alle Mutes aufheben
  mutedServices.forEach(serviceId => {
    const btn = document.querySelector(`.mute-btn[data-service="${serviceId}"]`);
    const container = document.getElementById(`${serviceId}-container`);
    if (btn) {
      btn.textContent = '🔔';
      btn.title = 'Nächste Nachricht überspringen';
    }
    if (container) {
      container.classList.remove('muted');
    }
  });
  mutedServices.clear();
}

// === FOCUS FUNKTIONEN ===

function toggleFocus(serviceId) {
  console.log('toggleFocus called:', serviceId, 'current focused:', focusedService);
  if (focusedService === serviceId) {
    // Bereits fokussiert -> beenden
    exitFocus();
  } else {
    // Neuen Service fokussieren
    enterFocus(serviceId);
  }
}

function enterFocus(serviceId) {
  console.log('enterFocus:', serviceId);
  // Vorherigen Zustand speichern
  previousLayout = {
    activeServices: [...userSettings.activeServices],
    focusedService: focusedService
  };
  
  focusedService = serviceId;
  
  // Alle Container verstecken außer dem fokussierten
  userSettings.activeServices.forEach(id => {
    const container = document.getElementById(`${id}-container`);
    console.log('Processing container:', id, container ? 'found' : 'NOT FOUND');
    if (container) {
      if (id === serviceId) {
        container.classList.remove('hidden-by-focus');
        container.classList.add('is-focused');
        // Focus-Button zu Zurück-Button ändern
        const focusBtn = container.querySelector('.focus-btn');
        if (focusBtn) {
          focusBtn.textContent = '↩️';
          focusBtn.title = 'Zurück zur Übersicht';
          focusBtn.classList.add('unfocus-btn');
        }
      } else {
        container.classList.add('hidden-by-focus');
      }
    }
  });
  
  // Grid auf 1 Spalte/Zeile setzen
  webviewGrid.classList.add('focus-mode');
  console.log('Focus mode enabled');
}

function exitFocus() {
  console.log('exitFocus called, focusedService:', focusedService);
  if (!focusedService) return;
  
  // Alle Container wieder anzeigen
  userSettings.activeServices.forEach(id => {
    const container = document.getElementById(`${id}-container`);
    if (container) {
      container.classList.remove('hidden-by-focus');
      container.classList.remove('is-focused');
      // Zurück-Button zu Focus-Button ändern
      const focusBtn = container.querySelector('.focus-btn');
      if (focusBtn) {
        focusBtn.textContent = '🔍';
        focusBtn.title = 'Nur dieses Fenster anzeigen';
        focusBtn.classList.remove('unfocus-btn');
      }
    }
  });
  
  focusedService = null;
  previousLayout = null;
  
  // Grid-Modus zurücksetzen
  webviewGrid.classList.remove('focus-mode');
  console.log('Focus mode disabled');
}

// Expose for debugging
window.getLastResponse = getLastResponse;
window.toggleFocus = toggleFocus;
window.exitFocus = exitFocus;
window.getAllResponses = getAllResponses;
window.copyResponse = copyResponse;
window.crossCompare = crossCompare;
window.compareAll = compareAll;
window.evaluateYesNo = evaluateYesNo;

// Focus und Start
promptInput.focus();
init();

console.log('LLM MultiChat initializing...');
