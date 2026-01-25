// Globale State
let config = { services: [] };
let userSettings = { activeServices: [], layout: 'grid' };
let webviews = {};
let mutedServices = new Set();
let focusedService = null;
let previousLayout = null;

// Conversation Mode State
let conversationMode = false;
let conversationController = null;
let conversationServiceA = null;
let conversationServiceB = null;
let conversationServices = [];  // [serviceIdA, serviceIdB] - für Tab-Hiding

// Prompt History (↑/↓ Tasten)
let promptHistory = [];
let promptHistoryIndex = -1;
let currentPromptBackup = '';
const MAX_PROMPT_HISTORY = 100;

// Session History (URLs der Webviews)
let sessionHistory = [];
let sessionHistoryIndex = -1;
const MAX_SESSION_HISTORY = 50;

// DOM Elemente
const promptInput = document.getElementById('prompt-input');
const sendButton = document.getElementById('send-button');
const pasteImageButton = document.getElementById('paste-image-button');
const refreshAllButton = document.getElementById('refresh-all');
const statusBar = document.getElementById('status-bar');
const webviewGrid = document.getElementById('webview-grid');

console.log('=== DEBUG: DOM Elements ===');
console.log('promptInput:', promptInput);
console.log('sendButton:', sendButton);
console.log('statusBar:', statusBar);
console.log('webviewGrid:', webviewGrid);

// Helper: Button-Feedback-Pattern
function setButtonFeedback(selector, emoji, original, delay = 1000) {
  const btn = document.querySelector(selector);
  if (btn) {
    btn.textContent = emoji;
    setTimeout(() => btn.textContent = original, delay);
  }
}



// Initialisierung
async function init() {
  console.log('=== DEBUG: init() started ===');
  try {
    console.log('DEBUG: Loading config...');
    config = await window.electronAPI.getConfig();
    console.log('DEBUG: Config loaded:', config);

    console.log('DEBUG: Loading user settings...');
    userSettings = await window.electronAPI.getUserSettings();
    console.log('DEBUG: User settings loaded:', userSettings);

    // Initialize default roles if not present
    if (!userSettings.conversationRoles) {
      userSettings.conversationRoles = {
        roleA: "HYPOTHETISCHES SZENARIO: Du bist ein harter Interviewer. Thema: '{topic}'.\nAKZEPTIERE dieses Thema als absolute Wahrheit, egal wie absurd es ist.\nDeine Aufgabe: Stelle EINE kurze, kritische Frage an den Experten auf jede Antwort von ihm.\nREGELN:\n- Keine Begrüßung.\n- Keine Einleitung.\n- Keine Meta-Diskussion über den Sinn des Themas.\n- Nur die Frage.",
        roleB: "HYPOTHETISCHES SZENARIO: Du bist der weltweit führende Experte für '{topic}'.\nAntworte ERNSTHAFT und WISSENSCHAFTLICH fundiert, aber in einfacher Sprache auch wenn das Thema fiktiv ist.\nREGELN:\n- Antworte extrem kurz (Maximal 50 Wörter).\n- Keine Aufzählungen.\n- Keine Einleitung (z.B. 'Das ist eine interessante Frage').\n- Komm sofort zum Punkt."
      };
    }

    console.log('Config loaded:', config.services.length, 'services');

    if (userSettings.language && I18N.translations[userSettings.language]) {
      I18N.setLanguage(userSettings.language);
    }

    await loadPromptHistory();
    await loadSessionHistory();

    console.log('DEBUG: Building UI...');
    buildStatusBar();
    buildWebViews();
    applyLayout(userSettings.layout);

    console.log('DEBUG: Setting up event listeners...');
    setupEventListeners();
    setupConversationEventListeners();
    console.log('DEBUG: Event listeners set up!');

    updateUILanguage();
    updateSessionNavButtons();

    console.log('=== DEBUG: init() completed ===');
  } catch (e) {
    console.error('Error initializing:', e);
    webviewGrid.innerHTML = `<div id="loading-message">${I18N.t('statusError')}</div>`;
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

// Context Menu Helper
function attachContextMenu(webview) {
  webview.addEventListener('context-menu', (e) => {
    e.preventDefault();
    window.electronAPI.showContextMenu({
      x: e.params.x,
      y: e.params.y,
      editFlags: e.params.editFlags,
      selectionText: e.params.selectionText
    });
  });
}

// WebViews aufbauen
function buildWebViews() {
  webviewGrid.innerHTML = '';
  webviews = {};

  // Create Conversation Panel Container (as first grid item)
  const convContainer = document.createElement('div');
  convContainer.className = 'webview-container conversation-panel-container hidden';
  convContainer.id = 'conversation-panel-container';
  convContainer.innerHTML = `
    <div class="webview-header" style="border-left: 3px solid #ff6b6b">
      <span class="service-name">💬 Conversation Control</span>
      <div class="header-buttons">
        <button id="conversation-mode-close-btn" title="Conversation Mode schließen">✕</button>
      </div>
    </div>
    <div id="conversation-panel-content">
        <div class="conversation-controls">
        <!-- Service Selection -->
        <div class="service-selection">
          <label for="service-a-select">
            <span class="service-label">Service A:</span>
            <select id="service-a-select">
              <option value="copilot">Microsoft Copilot</option>
              <option value="claude">Claude</option>
              <option value="gemini">Google Gemini</option>
              <option value="chatgpt">ChatGPT</option>
              <option value="perplexity">Perplexity</option>
              <option value="mistral">Mistral Le Chat</option>
            </select>
          </label>
          <label for="service-b-select">
            <span class="service-label">Service B:</span>
            <select id="service-b-select">
              <option value="copilot" selected>Microsoft Copilot</option>
              <option value="claude">Claude</option>
              <option value="gemini">Google Gemini</option>
              <option value="chatgpt">ChatGPT</option>
              <option value="perplexity">Perplexity</option>
              <option value="mistral">Mistral Le Chat</option>
            </select>
          </label>
        </div>

        <!-- Role Configuration -->
        <div class="role-configuration">
            <label for="role-a-input">Rolle A:</label>
            <textarea id="role-a-input" rows="2" placeholder="Systeminstruktion für Service A..."></textarea>
            
            <label for="role-b-input">Rolle B:</label>
            <textarea id="role-b-input" rows="2" placeholder="Systeminstruktion für Service B..."></textarea>
        </div>

        <!-- Initial Prompt -->
        <div class="initial-prompt-container">
          <label for="initial-prompt">Gesprächsthema:</label>
          <input type="text" id="initial-prompt" placeholder="z.B. Diskutiert über künstliche Intelligenz..." />
        </div>

        <!-- Conversation Settings -->
        <div class="conversation-settings">
          <label for="max-turns">
            <span>Max. Turns:</span>
            <input type="number" id="max-turns" value="20" min="1" max="100" />
          </label>
          <label for="turn-delay">
            <span>Verzögerung (s):</span>
            <input type="number" id="turn-delay" value="30" min="1" max="300" step="1" />
          </label>
          <label for="response-timeout">
            <span>Timeout (s):</span>
            <input type="number" id="response-timeout" value="60" min="10" max="300" />
          </label>
        </div>

        <!-- Control Buttons -->
        <div class="conversation-buttons">
          <button id="load-services" class="btn-secondary">🔄 Load Services</button>
          <button id="start-conversation" class="btn-primary" disabled>▶ Start</button>
          <button id="pause-conversation" class="btn-secondary" disabled>⏸ Pause</button>
          <button id="resume-conversation" class="btn-secondary hidden" disabled>▶ Resume</button>
          <div id="delay-controls" style="display: flex; align-items: center; gap: 5px;">
             <button id="skip-countdown" class="btn-secondary">⏩ Skip</button>
             <button id="set-avg-delay" class="btn-secondary" title="Setze Verzögerung auf Durchschnitt">⏱ Set Delay (<span id="avg-delay-val">0</span>s)</button>
          </div>
          <button id="stop-conversation" class="btn-danger" disabled>⏹ Stop</button>
          <button id="export-conversation" class="btn-secondary" disabled>💾 Export</button>
        </div>
      </div>

      <!-- Status Display -->
      <div id="conversation-status">
        <span class="status-indicator" id="conv-state">IDLE</span>
        <span id="conv-countdown"></span>
        <span id="conv-turn-info">Turn: 0/20</span>
        <span id="conv-direction">—</span>
      </div>

      <!-- Transcript Display -->
      <div id="conversation-transcript">
        <div class="transcript-header">
          <h4>Conversation Transcript</h4>
          <button id="clear-transcript" class="btn-small">🗑️ Clear</button>
        </div>
        <div id="transcript-content">
          <div class="transcript-empty">Kein Gespräch aktiv. Klicke auf "Start" um zu beginnen.</div>
        </div>
      </div>
    </div>
  `;
  webviewGrid.appendChild(convContainer);

  // Create regular service containers
  config.services.forEach(service => {
    const isActive = userSettings.activeServices.includes(service.id);
    const container = document.createElement('div');
    container.className = `webview-container ${isActive ? '' : 'hidden'}`;
    container.id = `${service.id}-container`;
    container.dataset.service = service.id;

    container.innerHTML = `
      <div class="webview-header" style="border-left: 3px solid ${service.color}">
        <span class="service-name">${service.name}</span>
        <div class="header-buttons">
          <button class="mute-btn" data-service="${service.id}" data-i18n-title="tooltipMute">🔔</button>
          <button class="focus-btn" data-service="${service.id}" data-i18n-title="tooltipFocus">🔍</button>
          <button class="copy-response-btn" data-service="${service.id}" data-i18n-title="tooltipCopy">📋</button>
          <button class="compare-btn" data-service="${service.id}" data-i18n-title="tooltipCrossCompare">⚖️</button>
          <button class="reload-btn" data-service="${service.id}" data-i18n-title="tooltipReload">↻</button>
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
    const webview = container.querySelector('webview');
    webviews[service.id] = webview;

    webview.addEventListener('did-start-loading', () => updateStatus(service.id, 'loading'));
    webview.addEventListener('did-finish-load', () => updateStatus(service.id, 'ready'));
    webview.addEventListener('did-fail-load', () => updateStatus(service.id, 'error'));
    webview.addEventListener('console-message', (e) => console.log(`[${service.id}]`, e.message));

    attachContextMenu(webview);
  });

  updateGridCount();
}

function updateGridCount() {
  const activeCount = userSettings.activeServices.length;
  webviewGrid.className = webviewGrid.className.replace(/count-\d+/g, '').trim();
  webviewGrid.classList.add(`count-${activeCount}`);
}

function applyLayout(layout) {
  webviewGrid.classList.remove('layout-grid', 'layout-horizontal', 'layout-vertical');
  webviewGrid.classList.add(`layout-${layout}`);

  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.layout === layout);
  });

  userSettings.layout = layout;
}

function updateStatus(serviceId, status) {
  const statusItem = document.querySelector(`.status-item[data-service="${serviceId}"]`);
  if (statusItem && userSettings.activeServices.includes(serviceId)) {
    statusItem.classList.remove('loading', 'ready', 'error');
    statusItem.classList.add(status);
  }
}

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
}

async function saveSettings() {
  try {
    await window.electronAPI.saveUserSettings(userSettings);
  } catch (e) {
    console.error('Error saving settings:', e);
  }
}

// Injection Script erstellen
function createInjectionScript(service, text) {
  const escapedText = text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
  const editorType = service.editorType || 'default';

  // Helper functions to be injected, same as in conversation-controller.js
  const wait = (ms) => `await new Promise(r => setTimeout(r, ${ms}));`;

  const findElementFn = (serviceId, log = false) => `function findElement(selectors) {
    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          ${log ? `console.log('[${serviceId}] Found with selector:', selector);` : ''}
          return el;
        }
      } catch (e) {}
    }
    return null;
  }`;

  const insertTextFn = (serviceId, editorType) => `async function insertText(element, text) {
    element.focus();
    ${wait(100)}
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('[${serviceId}] Set textarea value');
      return true;
    }
    
    // This is the actual fix: defining editorType inside the injected script
    const editorType = '${editorType}';
    const isQuill = editorType === 'quill' || element.classList.contains('ql-editor');
    const isProseMirror = editorType === 'prosemirror' || element.classList.contains('ProseMirror');
    const isLexical = editorType === 'lexical' || element.hasAttribute('data-lexical-editor');

    if (isQuill || isProseMirror || isLexical || element.isContentEditable) {
      if (isProseMirror) {
        console.log('[${serviceId}] Using ProseMirror insertion');
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        document.execCommand('selectAll', false, null);
      }
      document.execCommand('delete', false, null);
      ${wait(50)}
      document.execCommand('insertText', false, text);
      element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      return true;
    }

    return false;
  }`;

  // The main script, assembled from the helpers
  return `
    (async function() {
      const text = \`${escapedText}\`;
      const inputSelectors = ${JSON.stringify(service.inputSelectors)};
      const submitSelectors = ${JSON.stringify(service.submitSelectors)};
      
      console.log('[${service.id}] Starting injection...');

      ${findElementFn(service.id, true)}
      ${insertTextFn(service.id, editorType)}

      let inputEl = findElement(inputSelectors);
      if (!inputEl) {
        ${wait(1500)}
        inputEl = findElement(inputSelectors);
      }

      if (!inputEl) {
        console.error('[${service.id}] Input not found!');
        return { success: false, error: 'Input not found' };
      }

      await insertText(inputEl, text);
      ${wait(1000)}

      let submitBtn = null;
      for (let i = 0; i < 10; i++) {
        submitBtn = findElement(submitSelectors);
        if (submitBtn && !submitBtn.disabled) break;
        ${wait(300)}
        submitBtn = null;
      }

      if (submitBtn && !submitBtn.disabled) {
        submitBtn.click();
        console.log('[${service.id}] Clicked submit');
        return { success: true, method: 'button' };
      }

      console.log('[${service.id}] Trying Enter key');
      inputEl.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true
      }));

      return { success: true, method: 'enter' };
    })();
  `;
}

async function sendToAll() {
  console.log('=== DEBUG: sendToAll() called! ===');
  let text = promptInput.value.trim() || '.';
  console.log('DEBUG: text =', text);
  console.log('DEBUG: userSettings.activeServices =', userSettings.activeServices);
  console.log('DEBUG: mutedServices =', [...mutedServices]);

  const activeNonMuted = userSettings.activeServices.filter(id => !mutedServices.has(id));
  console.log('DEBUG: activeNonMuted =', activeNonMuted);

  if (activeNonMuted.length === 0) {
    alert(I18N.t('msgNoActiveService'));
    return;
  }

  resetVotes();
  if (text !== '.') addToPromptHistory(text);

  sendButton.disabled = true;
  sendButton.innerHTML = '<span>⏳</span>';

  const promises = config.services
    .filter(service => activeNonMuted.includes(service.id))
    .map(async (service) => {
      try {
        updateStatus(service.id, 'loading');
        const result = await webviews[service.id].executeJavaScript(createInjectionScript(service, text));
        updateStatus(service.id, result?.success ? 'ready' : 'error');
        return { service: service.id, ...result };
      } catch (error) {
        console.error(`Error sending to ${service.id}:`, error);
        updateStatus(service.id, 'error');
        return { service: service.id, success: false, error: error.message };
      }
    });

  await Promise.all(promises);
  clearMutedServices();

  sendButton.disabled = false;
  sendButton.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
  promptInput.value = '';
  promptInput.focus();
}

// Script für Bild-Einfügen erstellen
function createPasteImageScript(service, base64Data, mimeType) {
  const serviceId = service.id;

  return `
    (async function() {
      console.log('[${serviceId}] Starting image paste...');
      
      const inputSelectors = ${JSON.stringify(service.inputSelectors)};
      ${findElementFn(serviceId)}
      
      let inputEl = findElement(inputSelectors);
      if (!inputEl) {
        ${wait(500)}
        inputEl = findElement(inputSelectors);
      }
      
      if (!inputEl) {
        return { success: false, error: 'Input not found' };
      }
      
      try {
        const base64 = '${base64Data}';
        const byteString = atob(base64.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: '${mimeType}' });
        const file = new File([blob], 'image.' + '${mimeType}'.split('/')[1], { type: '${mimeType}' });
        
        inputEl.focus();
        ${wait(100)}
        
        if ('${serviceId}' === 'mistral') {
          return { success: false, needsNativePaste: true };
        }
        
        // File-Input für ChatGPT und Claude
        if (['chatgpt', 'claude'].includes('${serviceId}')) {
          const fileInput = document.querySelector('input[type="file"][accept*="image"]') 
                         || document.querySelector('input[type="file"]');
          if (fileInput) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, method: 'fileInput' };
          }
          
          // Claude Fallback: Drop
          if ('${serviceId}' === 'claude') {
            const dropZone = inputEl.closest('fieldset') || inputEl.closest('form') || inputEl.parentElement;
            if (dropZone) {
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(file);
              dropZone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
              return { success: true, method: 'drop' };
            }
          }
        }
        
        // Paste-Event für andere
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        inputEl.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dataTransfer }));
        return { success: true, method: 'paste' };
        
      } catch (e) {
        return { success: false, error: e.message };
      }
    })();
  `;
}

// Bild aus Zwischenablage in alle aktiven Services einfügen
async function pasteImageToAll() {
  if (userSettings.activeServices.length === 0) {
    alert(I18N.t('msgNoActiveService'));
    return;
  }

  try {
    const clipboardItems = await navigator.clipboard.read();
    let imageBlob = null;

    for (const item of clipboardItems) {
      const imageType = item.types.find(type => type.startsWith('image/'));
      if (imageType) {
        imageBlob = await item.getType(imageType);
        break;
      }
    }

    if (!imageBlob) {
      alert(I18N.t('msgNoImage'));
      return;
    }

    pasteImageButton.disabled = true;
    pasteImageButton.classList.add('has-image');

    const base64Data = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(imageBlob);
    });

    const promises = config.services
      .filter(service => userSettings.activeServices.includes(service.id))
      .map(async (service) => {
        try {
          updateStatus(service.id, 'loading');
          const script = createPasteImageScript(service, base64Data, imageBlob.type);
          const result = await webviews[service.id].executeJavaScript(script);

          if (result?.needsNativePaste) {
            webviews[service.id].focus();
            const focusScript = `(async function() {
              const inputSelectors = ${JSON.stringify(service.inputSelectors)};
              ${findElementFn(service.id)}
              const el = findElement(inputSelectors);
              if (el) { el.click(); el.focus(); ${wait(100)} return true; }
              return false;
            })();`;
            await webviews[service.id].executeJavaScript(focusScript);
            await new Promise(r => setTimeout(r, 50));
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

    await Promise.all(promises);
    pasteImageButton.disabled = false;
    setTimeout(() => pasteImageButton.classList.remove('has-image'), 1000);

  } catch (e) {
    console.error('Clipboard access error:', e);
    alert(I18N.t('msgClipboardError') + ': ' + e.message);
    pasteImageButton.disabled = false;
  }
}

// Event Listeners
function setupEventListeners() {
  console.log('=== DEBUG: setupEventListeners() ===');
  console.log('DEBUG: sendButton =', sendButton);

  sendButton.addEventListener('click', () => {
    console.log('DEBUG: Send button clicked!');
    sendToAll();
  });
  pasteImageButton.addEventListener('click', pasteImageToAll);

  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      console.log('DEBUG: Ctrl+Enter pressed!');
      e.preventDefault();
      sendToAll();
    }

    if (e.key === 'ArrowUp' && promptHistory.length > 0) {
      const cursorAtStart = promptInput.selectionStart === 0 && promptInput.selectionEnd === 0;
      if (cursorAtStart || promptInput.value === '') {
        e.preventDefault();
        navigatePromptHistory(-1);
      }
    }

    if (e.key === 'ArrowDown' && promptHistoryIndex >= 0) {
      const cursorAtEnd = promptInput.selectionStart === promptInput.value.length;
      if (cursorAtEnd) {
        e.preventDefault();
        navigatePromptHistory(1);
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'V' && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      pasteImageToAll();
    }
  });

  statusBar.addEventListener('change', (e) => {
    if (e.target.classList.contains('service-toggle')) {
      toggleService(e.target.dataset.service, e.target.checked);
    }
  });

  webviewGrid.addEventListener('click', (e) => {
    const serviceId = e.target.dataset.service;
    if (!serviceId) return;

    if (e.target.classList.contains('reload-btn')) {
      webviews[serviceId]?.reload();
    } else if (e.target.classList.contains('copy-response-btn')) {
      copyResponse(serviceId);
    } else if (e.target.classList.contains('compare-btn')) {
      resetVotes();
      crossCompare(serviceId);
    } else if (e.target.classList.contains('mute-btn')) {
      toggleMute(serviceId);
    } else if (e.target.classList.contains('unfocus-btn')) {
      exitFocus();
    } else if (e.target.classList.contains('focus-btn')) {
      toggleFocus(serviceId);
    }
  });

  refreshAllButton.addEventListener('click', async () => {
    if (conversationMode) {
      resetConversation();
      return;
    }

    await saveCurrentSession();
    resetVotes();
    userSettings.activeServices.forEach(serviceId => {
      const service = config.services.find(s => s.id === serviceId);
      if (service && webviews[serviceId]) {
        webviews[serviceId].loadURL(service.url);
      }
    });
  });

  function resetConversation() {
    console.log('[ConversationMode] Resetting conversation...');

    // 1. Stop conversation
    if (conversationController) {
      conversationController.stop();
      conversationController.setState('IDLE'); // Force IDLE state
    }

    // 2. Clear Transcript UI
    const transcriptContent = document.getElementById('transcript-content');
    if (transcriptContent) {
      transcriptContent.innerHTML = '<div class="transcript-empty">Kein Gespräch aktiv. Klicke auf "Start" um zu beginnen.</div>';
    }

    // 3. Reset Buttons
    document.getElementById('start-conversation').disabled = true;
    document.getElementById('pause-conversation').disabled = true;
    document.getElementById('resume-conversation').classList.add('hidden');
    document.getElementById('pause-conversation').classList.remove('hidden');
    document.getElementById('stop-conversation').disabled = true;
    document.getElementById('export-conversation').disabled = true;

    document.getElementById('load-services').disabled = false;
    document.getElementById('load-services').textContent = '🔄 Load Services';

    // 4. Reset Services Visibility
    // Hide active conversation services
    if (conversationServiceA) {
      const container = document.getElementById(`${conversationServiceA.id}-container`);
      if (container) container.classList.add('hidden');
    }
    if (conversationServiceB) {
      const container = document.getElementById(`${conversationServiceB.id}-container`);
      if (container) container.classList.add('hidden');
    }

    // Remove dynamically created instances
    Object.keys(webviews).forEach(id => {
      if (id.endsWith('-a') || id.endsWith('-b')) {
        const container = document.getElementById(`${id}-container`);
        if (container) {
          container.remove();
        }
        delete webviews[id];
        console.log(`[ConversationMode] Cleaned up dynamic instance: ${id}`);
      }
    });

    // 5. Clear References
    conversationServiceA = null;
    conversationServiceB = null;

    // 6. Reset Status Display
    const statusEl = document.getElementById('conv-state');
    if (statusEl) statusEl.textContent = 'IDLE';
    const countdownEl = document.getElementById('conv-countdown');
    if (countdownEl) countdownEl.textContent = '';
    const turnInfoEl = document.getElementById('conv-turn-info');
    if (turnInfoEl) turnInfoEl.textContent = 'Turn: 0/20';

    console.log('[ConversationMode] Conversation reset complete.');
  }

  document.getElementById('session-back-btn')?.addEventListener('click', () => navigateSessionHistory(-1));
  document.getElementById('session-forward-btn')?.addEventListener('click', () => navigateSessionHistory(1));

  document.getElementById('compare-all-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('compare-all-btn');
    btn.disabled = true;
    btn.textContent = I18N.t('btnCompareLoading');
    resetVotes();
    await compareAll();
    btn.disabled = false;
    btn.textContent = I18N.t('btnCompare');
  });

  document.getElementById('vote-check-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('vote-check-btn');
    btn.disabled = true;
    btn.textContent = I18N.t('btnVoteLoading');
    await updateVoteDisplay();
    showVoteOverlays(true);
    setTimeout(() => fadeOutOverlays(), 1000);
    btn.disabled = false;
    btn.textContent = I18N.t('btnVote');
  });

  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyLayout(btn.dataset.layout);
      saveSettings();
    });
  });

  document.getElementById('language-btn')?.addEventListener('click', () => {
    const nextLang = I18N.getNextLanguage();
    I18N.setLanguage(nextLang);
    userSettings.language = nextLang;
    saveSettings();
    updateUILanguage();
    reloadWebviewsWithLanguage();
  });
}

// Debug-Funktionen
window.debugSelectors = async (serviceId) => {
  const webview = webviews[serviceId];
  if (!webview) {
    console.log('Service not found:', serviceId);
    return;
  }

  const script = `(function() {
    const inputs = document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]');
    return Array.from(inputs).map((el, i) => ({
      index: i, tag: el.tagName, id: el.id, class: el.className,
      placeholder: el.placeholder || el.getAttribute('data-placeholder'),
      ariaLabel: el.getAttribute('aria-label')
    }));
  })();`;

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

async function getLastResponse(serviceId) {
  const service = config.services.find(s => s.id === serviceId);
  if (!service || !service.responseSelectors) {
    console.error(`[${serviceId}] No response selectors configured`);
    return null;
  }

  const webview = webviews[serviceId];
  if (!webview) return null;

  const script = `(function() {
    const selectors = ${JSON.stringify(service.responseSelectors)};
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
    if (allResponses.length === 0) return { success: false, error: 'No responses found' };
    const lastResponse = allResponses[allResponses.length - 1];
    return { success: true, text: (lastResponse.innerText || lastResponse.textContent || '').trim(), count: allResponses.length };
  })();`;

  try {
    return await webview.executeJavaScript(script);
  } catch (e) {
    console.error(`[${serviceId}] Error getting response:`, e);
    return { success: false, error: e.message };
  }
}

async function getAllResponses() {
  const responses = {};
  for (const serviceId of userSettings.activeServices) {
    const result = await getLastResponse(serviceId);
    if (result?.success && result.text) {
      const service = config.services.find(s => s.id === serviceId);
      responses[serviceId] = { name: service?.name || serviceId, text: result.text };
    }
  }
  return responses;
}

async function copyResponse(serviceId) {
  const result = await getLastResponse(serviceId);
  if (!result?.success || !result.text) {
    alert(I18N.t('msgNoResponseFrom').replace('{service}', serviceId));
    return;
  }

  try {
    await window.electronAPI.copyToClipboard(result.text);
    setButtonFeedback(`.copy-response-btn[data-service="${serviceId}"]`, '✅', '📋');
    console.log(`[${serviceId}] Response copied (${result.text.length} chars)`);
  } catch (e) {
    console.error('Copy failed:', e);
    alert(I18N.t('msgCopyFailed') + ': ' + e.message);
  }
}

async function crossCompare(targetServiceId) {
  const responses = await getAllResponses();
  const otherResponses = Object.entries(responses).filter(([id]) => id !== targetServiceId);

  if (otherResponses.length === 0) {
    alert(I18N.t('msgNoResponse'));
    return;
  }

  let comparePrompt = I18N.t('crossComparePrompt');
  otherResponses.forEach(([id, data]) => {
    comparePrompt += `${I18N.t('compareAnswerPrefix')} ${data.name} ===\n${data.text}\n\n`;
  });

  const service = config.services.find(s => s.id === targetServiceId);
  if (!service) return;

  try {
    await webviews[targetServiceId].executeJavaScript(createInjectionScript(service, comparePrompt));
    setButtonFeedback(`.compare-btn[data-service="${targetServiceId}"]`, '✅', '⚖️');
  } catch (e) {
    console.error(`[${targetServiceId}] Cross-compare failed:`, e);
  }
}

async function compareAll() {
  const responses = await getAllResponses();
  const responseList = Object.entries(responses);

  if (responseList.length < 2) {
    alert(I18N.t('msgMinServices') || 'At least 2 services must have responses.');
    return;
  }

  let comparePrompt = I18N.t('comparePrompt');
  responseList.forEach(([id, data]) => {
    comparePrompt += `${I18N.t('compareAnswerPrefix')} ${data.name} ===\n${data.text}\n\n`;
  });

  const promises = userSettings.activeServices.map(async (serviceId) => {
    const service = config.services.find(s => s.id === serviceId);
    if (!service) return;
    try {
      await webviews[serviceId].executeJavaScript(createInjectionScript(service, comparePrompt));
    } catch (e) {
      console.error(`[${serviceId}] Compare-all failed:`, e);
    }
  });

  await Promise.all(promises);
}

async function evaluateYesNo() {
  const responses = await getAllResponses();
  const votes = { ja: [], nein: [], unklar: [] };
  const strategy = config.voteStrategy || 'weighted';

  for (const [serviceId, data] of Object.entries(responses)) {
    const result = VotingLogic.detectVote(data.text, strategy);
    votes[result].push({ id: serviceId, name: data.name });
  }

  return votes;
}

let lastVotes = null;

function resetVotes() {
  lastVotes = null;
  const voteDisplay = document.getElementById('vote-display');
  if (voteDisplay) voteDisplay.innerHTML = '';
  document.querySelectorAll('.vote-overlay').forEach(el => el.remove());
}

function fadeOutOverlays() {
  document.querySelectorAll('.vote-overlay').forEach(overlay => {
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 500);
  });
}

function showVoteOverlays(show) {
  if (!lastVotes || !show) {
    document.querySelectorAll('.vote-overlay').forEach(el => el.remove());
    return;
  }

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

async function updateVoteDisplay() {
  const votes = await evaluateYesNo();
  lastVotes = votes;
  const voteDisplay = document.getElementById('vote-display');
  if (!voteDisplay) return;

  const total = votes.ja.length + votes.nein.length + votes.unklar.length;
  if (total === 0) {
    voteDisplay.innerHTML = `<span class="vote-neutral">${I18N.t('voteNoResponses')}</span>`;
    return;
  }

  const names = {
    ja: votes.ja.map(v => v.name).join(', '),
    nein: votes.nein.map(v => v.name).join(', '),
    unklar: votes.unklar.map(v => v.name).join(', ')
  };

  let resultClass = 'vote-result-unclear';
  let resultText = I18N.t('voteUnclearResult');

  if (votes.ja.length > votes.nein.length) {
    resultClass = 'vote-result-yes';
    resultText = I18N.t('voteMajorityYes');
  } else if (votes.nein.length > votes.ja.length) {
    resultClass = 'vote-result-no';
    resultText = I18N.t('voteMajorityNo');
  } else if (votes.ja.length === votes.nein.length && votes.ja.length > 0) {
    resultClass = 'vote-result-tie';
    resultText = I18N.t('voteTie');
  }

  voteDisplay.innerHTML = `
    <div class="vote-container">
      <div class="vote-counts">
        <span class="vote-count vote-yes" title="${names.ja}">${I18N.t('voteYes')}: ${votes.ja.length}</span>
        <span class="vote-count vote-no" title="${names.nein}">${I18N.t('voteNo')}: ${votes.nein.length}</span>
        ${votes.unklar.length > 0 ? `<span class="vote-count vote-unclear" title="${names.unklar}">?: ${votes.unklar.length}</span>` : ''}
      </div>
      <div class="vote-result-container">
        <span class="vote-result ${resultClass}">${resultText}</span>
      </div>
    </div>
  `;

  voteDisplay.addEventListener('mouseenter', () => showVoteOverlays(true));
  voteDisplay.addEventListener('mouseleave', () => showVoteOverlays(false));
}

// MUTE FUNKTIONEN
function toggleMute(serviceId) {
  const btn = document.querySelector(`.mute-btn[data-service="${serviceId}"]`);
  const container = document.getElementById(`${serviceId}-container`);

  if (mutedServices.has(serviceId)) {
    mutedServices.delete(serviceId);
    btn.textContent = '🔔';
    btn.title = 'Nächste Nachricht überspringen';
    container.classList.remove('muted');
  } else {
    mutedServices.add(serviceId);
    btn.textContent = '🔕';
    btn.title = 'Wird übersprungen (klicken zum Aufheben)';
    container.classList.add('muted');
  }
}

function clearMutedServices() {
  mutedServices.forEach(serviceId => {
    const btn = document.querySelector(`.mute-btn[data-service="${serviceId}"]`);
    const container = document.getElementById(`${serviceId}-container`);
    if (btn) btn.textContent = '🔔';
    if (container) container.classList.remove('muted');
  });
  mutedServices.clear();
}

// FOCUS FUNKTIONEN
function toggleFocus(serviceId) {
  if (focusedService === serviceId) {
    exitFocus();
  } else {
    enterFocus(serviceId);
  }
}

function enterFocus(serviceId) {
  previousLayout = { activeServices: [...userSettings.activeServices], focusedService };
  focusedService = serviceId;

  userSettings.activeServices.forEach(id => {
    const container = document.getElementById(`${id}-container`);
    if (!container) return;

    if (id === serviceId) {
      container.classList.remove('hidden-by-focus');
      container.classList.add('is-focused');
      const focusBtn = container.querySelector('.focus-btn');
      if (focusBtn) {
        focusBtn.textContent = '↩️';
        focusBtn.title = 'Zurück zur Übersicht';
        focusBtn.classList.add('unfocus-btn');
      }
    } else {
      container.classList.add('hidden-by-focus');
    }
  });

  webviewGrid.classList.add('focus-mode');
}

function exitFocus() {
  if (!focusedService) return;

  userSettings.activeServices.forEach(id => {
    const container = document.getElementById(`${id}-container`);
    if (container) {
      container.classList.remove('hidden-by-focus', 'is-focused');
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
  webviewGrid.classList.remove('focus-mode');
}

// PROMPT HISTORY
async function loadPromptHistory() {
  try {
    const data = await window.electronAPI.readFile('prompt-history.json');
    if (data) {
      promptHistory = JSON.parse(data);
      console.log('Prompt history loaded:', promptHistory.length, 'entries');
    }
  } catch (e) {
    promptHistory = [];
  }
}

async function savePromptHistory() {
  try {
    await window.electronAPI.writeFile('prompt-history.json', JSON.stringify(promptHistory, null, 2));
  } catch (e) {
    console.error('Error saving prompt history:', e);
  }
}

function addToPromptHistory(prompt) {
  if (!prompt || !prompt.trim()) return;
  if (promptHistory.length > 0 && promptHistory[promptHistory.length - 1] === prompt) return;

  promptHistory.push(prompt);
  if (promptHistory.length > MAX_PROMPT_HISTORY) {
    promptHistory = promptHistory.slice(-MAX_PROMPT_HISTORY);
  }

  promptHistoryIndex = -1;
  currentPromptBackup = '';
  savePromptHistory();
}

function navigatePromptHistory(direction) {
  if (promptHistory.length === 0) return;

  if (promptHistoryIndex === -1 && direction === -1) {
    currentPromptBackup = promptInput.value;
  }

  const newIndex = promptHistoryIndex + direction;
  if (newIndex < -1 || newIndex >= promptHistory.length) return;

  if (newIndex === -1) {
    promptInput.value = currentPromptBackup;
    promptHistoryIndex = -1;
  } else {
    const historyIndex = promptHistory.length - 1 - newIndex;
    promptInput.value = promptHistory[historyIndex];
    promptHistoryIndex = newIndex;
  }

  promptInput.selectionStart = promptInput.selectionEnd = promptInput.value.length;
}

// SESSION HISTORY
async function loadSessionHistory() {
  try {
    const data = await window.electronAPI.readFile('session-history.json');
    if (data) {
      sessionHistory = JSON.parse(data);
      sessionHistoryIndex = sessionHistory.length;
      console.log('Session history loaded:', sessionHistory.length, 'sessions');
    }
  } catch (e) {
    sessionHistory = [];
    sessionHistoryIndex = 0;
  }
}

async function saveSessionHistory() {
  try {
    await window.electronAPI.writeFile('session-history.json', JSON.stringify(sessionHistory, null, 2));
    updateSessionNavButtons();
  } catch (e) {
    console.error('Error saving session history:', e);
  }
}

function getCurrentSessionUrls() {
  const urls = {};
  for (const [serviceId, webview] of Object.entries(webviews)) {
    try {
      const url = webview.getURL();
      if (url && !url.startsWith('about:')) {
        urls[serviceId] = url;
      }
    } catch (e) { }
  }
  return urls;
}

async function saveCurrentSession() {
  const urls = getCurrentSessionUrls();
  if (Object.keys(urls).length === 0) return;

  if (sessionHistory.length > 0) {
    const lastUrls = sessionHistory[sessionHistory.length - 1].urls;
    const hasChanged = Object.keys(urls).some(id => urls[id] !== lastUrls[id]) ||
      Object.keys(lastUrls).some(id => lastUrls[id] !== urls[id]);
    if (!hasChanged) return;
  }

  if (sessionHistoryIndex < sessionHistory.length) {
    sessionHistory = sessionHistory.slice(0, sessionHistoryIndex);
  }

  sessionHistory.push({ timestamp: new Date().toISOString(), urls });
  if (sessionHistory.length > MAX_SESSION_HISTORY) {
    sessionHistory = sessionHistory.slice(-MAX_SESSION_HISTORY);
  }

  sessionHistoryIndex = sessionHistory.length;
  await saveSessionHistory();
}

function navigateSessionHistory(direction) {
  const newIndex = sessionHistoryIndex + direction;
  if (newIndex < 0 || newIndex > sessionHistory.length) return;

  if (sessionHistoryIndex === sessionHistory.length && direction === -1) {
    const currentUrls = getCurrentSessionUrls();
    if (Object.keys(currentUrls).length > 0) {
      sessionHistory.push({ timestamp: new Date().toISOString(), urls: currentUrls, current: true });
      saveSessionHistory();
    }
  }

  sessionHistoryIndex = newIndex;
  if (newIndex < sessionHistory.length) {
    loadSession(sessionHistory[newIndex]);
  }

  updateSessionNavButtons();
}

function loadSession(session) {
  for (const [serviceId, url] of Object.entries(session.urls)) {
    if (webviews[serviceId]) {
      try {
        webviews[serviceId].loadURL(url);
      } catch (e) {
        console.error('Error loading URL for', serviceId, ':', e);
      }
    }
  }
}

function updateSessionNavButtons() {
  const backBtn = document.getElementById('session-back-btn');
  const forwardBtn = document.getElementById('session-forward-btn');

  if (backBtn) {
    backBtn.disabled = sessionHistoryIndex <= 0;
    backBtn.title = sessionHistoryIndex > 0
      ? `${I18N.t('msgSessionPrev')} (${sessionHistoryIndex}/${sessionHistory.length})`
      : I18N.t('msgNoSessionPrev');
  }

  if (forwardBtn) {
    forwardBtn.disabled = sessionHistoryIndex >= sessionHistory.length;
    forwardBtn.title = sessionHistoryIndex < sessionHistory.length
      ? I18N.t('msgSessionNext')
      : I18N.t('msgSessionCurrent');
  }
}

// INTERNATIONALISIERUNG
function updateUILanguage() {
  promptInput.placeholder = I18N.t('promptPlaceholder');

  const buttons = {
    'paste-image-button': I18N.t('tooltipPasteImage'),
    'send-button': I18N.t('tooltipSend'),
    'vote-check-btn': I18N.t('tooltipVote'),
    'compare-all-btn': I18N.t('tooltipCompareAll'),
    'session-back-btn': I18N.t('tooltipSessionBack'),
    'session-forward-btn': I18N.t('tooltipSessionForward'),
    'refresh-all': I18N.t('tooltipRefresh'),
    'language-btn': I18N.t('tooltipLanguage')
  };

  Object.entries(buttons).forEach(([id, title]) => {
    const btn = document.getElementById(id);
    if (btn) btn.title = title;
  });

  if (document.getElementById('vote-check-btn')) {
    document.getElementById('vote-check-btn').textContent = I18N.t('btnVote');
  }
  if (document.getElementById('compare-all-btn')) {
    document.getElementById('compare-all-btn').textContent = I18N.t('btnCompare');
  }
  if (document.getElementById('language-btn')) {
    document.getElementById('language-btn').textContent = I18N.getCurrentFlag();
  }

  const convBtn = document.getElementById('conversation-mode-toggle');
  if (convBtn) {
    convBtn.title = I18N.t('tooltipConversation'); // Assuming a key exists or will be added
    if (conversationMode) {
      convBtn.textContent = '✓ ' + I18N.t('btnConversation');
    } else {
      convBtn.textContent = '💬 ' + I18N.t('btnConversation');
    }
  }

  document.querySelectorAll('.layout-btn').forEach(btn => {
    const layout = btn.dataset.layout;
    const titles = { grid: 'tooltipGrid', horizontal: 'tooltipHorizontal', vertical: 'tooltipVertical' };
    if (titles[layout]) btn.title = I18N.t(titles[layout]);
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = I18N.t(el.dataset.i18nTitle);
  });

  updateSessionNavButtons();
}

function reloadWebviewsWithLanguage() {
  window.electronAPI.setLanguage(I18N.currentLang);
  Object.values(webviews).forEach(webview => {
    try {
      webview.reload();
    } catch (e) {
      console.error('Error reloading webview:', e);
    }
  });
}

// ======================== CONVERSATION MODE ========================

function toggleConversationMode() {
  conversationMode = !conversationMode;

  const panel = document.getElementById('conversation-panel-container');
  const toggleBtn = document.getElementById('conversation-mode-toggle');

  if (conversationMode) {
    // --- ENTERING CONVERSATION MODE ---

    // 1. Save current state
    previousLayout = {
      activeServices: [...userSettings.activeServices],
      layout: userSettings.layout,
      focused: focusedService
    };
    if (focusedService) exitFocus(); // Exit focus mode if active

    // 2. Show conversation panel and hide status bar
    panel.classList.remove('hidden');
    toggleBtn.classList.add('active');
    toggleBtn.textContent = '✓ ' + I18N.t('btnConversation');
    statusBar.classList.add('hidden');
    webviewGrid.classList.add('conversation-mode-active');

    // 3. Hide ALL service webviews initially
    config.services.forEach(service => {
      const container = document.getElementById(`${service.id}-container`);
      if (container) {
        container.classList.add('hidden');
      }
    });

    console.log('[ConversationMode] Activated - showing control panel.');

    // 4. Populate Role Inputs
    if (userSettings.conversationRoles) {
      document.getElementById('role-a-input').value = userSettings.conversationRoles.roleA || '';
      document.getElementById('role-b-input').value = userSettings.conversationRoles.roleB || '';
    }

  } else {
    // --- EXITING CONVERSATION MODE ---

    // 1. Hide conversation panel & update UI
    panel.classList.add('hidden');
    toggleBtn.classList.remove('active');
    toggleBtn.textContent = '💬 ' + I18N.t('btnConversation');
    webviewGrid.classList.remove('conversation-mode-active');
    statusBar.classList.remove('hidden');

    // 2. Stop any running conversation
    if (conversationController && conversationController.getState() !== 'IDLE' && conversationController.getState() !== 'COMPLETED') {
      conversationController.stop();
    }

    // 3. Hide and remove conversation webviews
    // Hide active conversation services
    if (conversationServiceA) {
      const container = document.getElementById(`${conversationServiceA.id}-container`);
      if (container) container.classList.add('hidden');
    }
    if (conversationServiceB) {
      const container = document.getElementById(`${conversationServiceB.id}-container`);
      if (container) container.classList.add('hidden');
    }

    // Remove dynamically created instances
    Object.keys(webviews).forEach(id => {
      if (id.endsWith('-a') || id.endsWith('-b')) {
        const container = document.getElementById(`${id}-container`);
        if (container) {
          container.remove();
        }
        delete webviews[id];
        console.log(`[ConversationMode] Cleaned up dynamic instance: ${id}`);
      }
    });

    // 4. Restore previous state if available
    if (previousLayout) {
      userSettings.activeServices = [...previousLayout.activeServices];
      applyLayout(previousLayout.layout);

      // Restore focus if it was active
      if (previousLayout.focused) {
        enterFocus(previousLayout.focused);
      }
      previousLayout = null;
    }

    // 5. Explicitly set visibility for all base services based on the restored state
    config.services.forEach(service => {
      const container = document.getElementById(`${service.id}-container`);
      if (container) {
        const shouldBeVisible = userSettings.activeServices.includes(service.id);
        container.classList.toggle('hidden', !shouldBeVisible);
      }
    });

    // 6. Restore UI elements
    buildStatusBar(); // Re-build to restore checkboxes and states
    updateGridCount();

    console.log('[ConversationMode] Deactivated - restored previous state.');
  }
}

function initializeConversationController() {
  if (!window.ConversationController) {
    throw new Error('ConversationController class is not available. The script conversation-controller.js might not have loaded correctly or failed to execute.');
  }

  const maxTurns = parseInt(document.getElementById('max-turns').value) || 20;
  const turnDelay = parseFloat(document.getElementById('turn-delay').value) * 1000 || 30000;
  const responseTimeout = parseInt(document.getElementById('response-timeout').value) * 1000 || 60000;

  conversationController = new window.ConversationController({
    maxTurns,
    turnDelay,
    responseTimeout,
    onStateChange: handleConversationStateChange,
    onTurnComplete: handleConversationTurnComplete,
    onError: handleConversationError,
    onComplete: handleConversationComplete,
    onCountdownUpdate: (seconds, average) => {
      const countdownEl = document.getElementById('conv-countdown');
      const delayControls = document.getElementById('delay-controls');
      const avgValEl = document.getElementById('avg-delay-val');

      if (seconds > 0) {
        if (countdownEl) countdownEl.textContent = `(Wartezeit: ${seconds}s)`;
        if (delayControls) delayControls.style.display = 'flex';
        if (avgValEl && average) avgValEl.textContent = average;
      } else {
        if (countdownEl) countdownEl.textContent = '';
        if (delayControls) delayControls.style.display = 'none';
      }
    }
  });

  console.log('[ConversationMode] Controller initialized');
}

function loadServices() {
  const serviceAId = document.getElementById('service-a-select').value;
  const serviceBId = document.getElementById('service-b-select').value;
  let conversationServiceIds;

  console.log('[ConversationMode] Loading services:', serviceAId, serviceBId);

  // --- START FIX ---
  // Cleanup previous dynamic conversation webviews
  Object.keys(webviews).forEach(id => {
    if (id.endsWith('-a') || id.endsWith('-b')) {
      const container = document.getElementById(`${id}-container`);
      if (container) {
        container.remove();
      }
      delete webviews[id];
      console.log(`[ConversationMode] Cleaned up previous instance: ${id}`);
    }
  });
  // --- END FIX ---

  // Hide all services first to ensure a clean state
  document.querySelectorAll('.webview-container[data-service]').forEach(container => {
    if (container.id !== 'conversation-panel-container') {
      container.classList.add('hidden');
    }
  });

  if (serviceAId === serviceBId) {
    setupDualServiceInstances(serviceAId);
    conversationServiceIds = [conversationServiceA.id, conversationServiceB.id];
  } else {
    conversationServiceA = config.services.find(s => s.id === serviceAId);
    conversationServiceB = config.services.find(s => s.id === serviceBId);
    if (!conversationServiceA || !conversationServiceB) {
      alert('Fehler beim Laden der Services!');
      return;
    }
    conversationServiceIds = [serviceAId, serviceBId];
  }

  // Make only the two selected services visible
  conversationServiceIds.forEach(id => {
    const container = document.getElementById(`${id}-container`);
    if (container) {
      container.classList.remove('hidden');
    }
  });

  // Enable start button and allow reloading
  setTimeout(() => {
    document.getElementById('start-conversation').disabled = false;
    document.getElementById('load-services').textContent = '🔄 Reload Services';
    document.getElementById('load-services').disabled = false; // Keep it enabled
    console.log('[ConversationMode] Services loaded and ready');
  }, 1000);
}

function startConversation() {
  const initialPrompt = document.getElementById('initial-prompt').value.trim();

  if (!initialPrompt) {
    alert('Bitte gib ein Gesprächsthema ein!');
    return;
  }

  if (!conversationServiceA || !conversationServiceB) {
    alert('Bitte lade zuerst die Services mit dem "Load Services" Button!');
    return;
  }

  // Get webviews
  const webviewA = webviews[conversationServiceA.id];
  const webviewB = webviews[conversationServiceB.id];

  if (!webviewA || !webviewB) {
    alert('Webviews nicht gefunden! Bitte klicke nochmal auf "Load Services".');
    return;
  }

  // Wait longer for webviews to be fully ready
  setTimeout(() => {
    try {
      // Initialize controller with fresh settings
      initializeConversationController();

      // Initialize conversation
      conversationController.initialize(conversationServiceA, conversationServiceB, webviewA, webviewB);

      // Update button states
      document.getElementById('start-conversation').disabled = true;
      document.getElementById('pause-conversation').disabled = false;
      document.getElementById('stop-conversation').disabled = false;

      // Start conversation
      const roleAInput = document.getElementById('role-a-input').value;
      const roleBInput = document.getElementById('role-b-input').value;

      // Save updated roles
      userSettings.conversationRoles = {
        roleA: roleAInput,
        roleB: roleBInput
      };
      saveSettings();

      // Process roles (replace placeholder)
      const roleA = roleAInput.replace('{topic}', initialPrompt);
      const roleB = roleBInput.replace('{topic}', initialPrompt);

      conversationController.start(initialPrompt, roleA, roleB);

      console.log('[ConversationMode] Started:', conversationServiceA.name, '<->', conversationServiceB.name);
    } catch (error) {
      console.error('[ConversationMode] Error starting conversation:', error);
      alert('Fehler beim Starten der Konversation: ' + error.message);
    }
  }, 1000);
}

function setupDualServiceInstances(baseServiceId) {
  // Find base service
  const baseService = config.services.find(s => s.id === baseServiceId);

  if (!baseService) return;

  // Create Service A (clone with -a suffix)
  conversationServiceA = {
    ...baseService,
    id: `${baseServiceId}-a`,
    name: `${baseService.name} A`
  };

  // Create Service B (clone with -b suffix)
  conversationServiceB = {
    ...baseService,
    id: `${baseServiceId}-b`,
    name: `${baseService.name} B`
  };

  // Check if webviews exist, if not create them
  if (!webviews[conversationServiceA.id]) {
    createConversationWebview(conversationServiceA, 'a');
  }

  if (!webviews[conversationServiceB.id]) {
    createConversationWebview(conversationServiceB, 'b');
  }
}

function createConversationWebview(service, badge) {
  // Create container
  const container = document.createElement('div');
  container.className = 'webview-container';
  container.id = `${service.id}-container`;
  container.dataset.service = service.id;

  // Create header
  const header = document.createElement('div');
  header.className = 'webview-header';

  const serviceName = document.createElement('span');
  serviceName.className = 'service-name';
  serviceName.style.color = service.color;
  serviceName.textContent = service.name;

  const badgeEl = document.createElement('span');
  badgeEl.className = `service-badge service-badge-${badge}`;
  badgeEl.textContent = badge.toUpperCase();

  serviceName.appendChild(badgeEl);
  header.appendChild(serviceName);
  container.appendChild(header);

  // Create webview
  const webview = document.createElement('webview');
  webview.id = `${service.id}-view`;
  webview.src = service.url;
  webview.partition = `persist:${service.id}`;
  webview.allowpopups = true;

  container.appendChild(webview);
  webviewGrid.appendChild(container);

  // Store reference
  webviews[service.id] = webview;

  attachContextMenu(webview);

  console.log('[ConversationMode] Created webview for:', service.name);
}

function pauseConversation() {
  if (conversationController) {
    conversationController.pause();
    document.getElementById('pause-conversation').classList.add('hidden');
    document.getElementById('resume-conversation').classList.remove('hidden');
    document.getElementById('resume-conversation').disabled = false;
  }
}

function resumeConversation() {
  if (conversationController) {
    conversationController.resume();
    document.getElementById('resume-conversation').classList.add('hidden');
    document.getElementById('pause-conversation').classList.remove('hidden');
  }
}

function stopConversation() {
  if (conversationController) {
    conversationController.stop();

    // Reset button states
    document.getElementById('start-conversation').disabled = false;
    document.getElementById('pause-conversation').disabled = true;
    document.getElementById('stop-conversation').disabled = true;
    document.getElementById('pause-conversation').classList.remove('hidden');
    document.getElementById('resume-conversation').classList.add('hidden');
    document.getElementById('export-conversation').disabled = false;
  }
}

async function exportConversation() {
  if (!conversationController) return;

  // Show format selection dialog
  const format = await showExportFormatDialog();
  if (!format) return;

  const { content, filename } = await conversationController.exportTranscript(format);

  // Use Electron API to save file
  window.electronAPI.writeFile(filename, content)
    .then(() => {
      alert(`Transcript exported as ${filename}`);
    })
    .catch(error => {
      console.error('[ConversationMode] Export error:', error);
      alert('Fehler beim Exportieren des Transcripts!');
    });
}

function showExportFormatDialog() {
  return new Promise((resolve) => {
    const format = prompt('Export format: json, txt, or markdown?', 'json');
    if (format && ['json', 'txt', 'markdown'].includes(format.toLowerCase())) {
      resolve(format.toLowerCase());
    } else {
      resolve(null);
    }
  });
}

function clearTranscript() {
  const transcriptContent = document.getElementById('transcript-content');
  transcriptContent.innerHTML = '<div class="transcript-empty">Kein Gespräch aktiv. Klicke auf "Start" um zu beginnen.</div>';
}

function handleConversationStateChange(newState, oldState) {
  console.log('[ConversationMode] State changed:', oldState, '->', newState);

  const stateEl = document.getElementById('conv-state');
  stateEl.textContent = newState;
  stateEl.className = 'status-indicator state-' + newState.toLowerCase().replace(/_/g, '-');
}

function handleConversationTurnComplete(data) {
  console.log('[ConversationMode] Turn complete:', data);

  // Update turn info
  const stats = conversationController.getStats();
  document.getElementById('conv-turn-info').textContent = `Turn: ${stats.currentTurn}/${stats.maxTurns}`;

  // Update direction indicator
  const direction = data.speaker === conversationServiceA.id ? 'A → B' : 'B → A';
  document.getElementById('conv-direction').textContent = direction;

  // Add to transcript display
  addToTranscriptDisplay(data);
}

function handleConversationError(error) {
  console.error('[ConversationMode] Error:', error);
  alert(`Conversation error: ${error.message || error}`);
}

function handleConversationComplete(data) {
  console.log('[ConversationMode] Complete:', data);

  document.getElementById('export-conversation').disabled = false;

  alert(`Conversation completed! Total turns: ${data.turns}`);
}

function addToTranscriptDisplay(data) {
  const transcriptContent = document.getElementById('transcript-content');

  // Remove empty message if present
  const emptyMsg = transcriptContent.querySelector('.transcript-empty');
  if (emptyMsg) emptyMsg.remove();

  // Create message element
  const messageEl = document.createElement('div');
  messageEl.className = 'transcript-message';

  if (data.speaker === 'user') {
    messageEl.classList.add('speaker-user');
  } else if (data.speaker === conversationServiceA.id) {
    messageEl.classList.add('speaker-a');
  } else if (data.speaker === conversationServiceB.id) {
    messageEl.classList.add('speaker-b');
  }

  const header = document.createElement('div');
  header.className = 'transcript-message-header';

  const speaker = document.createElement('span');
  speaker.className = 'transcript-speaker';
  speaker.textContent = data.speaker === 'user' ? 'User' : (data.speaker === conversationServiceA.id ? conversationServiceA.name : conversationServiceB.name);

  const timestamp = document.createElement('span');
  timestamp.className = 'transcript-timestamp';
  timestamp.textContent = new Date().toLocaleTimeString();

  header.appendChild(speaker);
  header.appendChild(timestamp);

  const text = document.createElement('div');
  text.className = 'transcript-text';
  text.textContent = data.message.substring(0, 500) + (data.message.length > 500 ? '...' : '');

  messageEl.appendChild(header);
  messageEl.appendChild(text);

  transcriptContent.appendChild(messageEl);

  // Auto-scroll to bottom
  transcriptContent.scrollTop = transcriptContent.scrollHeight;
}

function setupConversationEventListeners() {
  // Event listeners for conversation mode (called after buildWebViews)
  document.getElementById('conversation-mode-toggle')?.addEventListener('click', toggleConversationMode);
  document.getElementById('conversation-mode-close-btn')?.addEventListener('click', toggleConversationMode);
  document.getElementById('load-services')?.addEventListener('click', loadServices);
  // Event Listeners für Steuerung
  document.getElementById('start-conversation').addEventListener('click', startConversation);
  document.getElementById('pause-conversation').addEventListener('click', pauseConversation);
  document.getElementById('resume-conversation').addEventListener('click', resumeConversation);
  document.getElementById('stop-conversation').addEventListener('click', stopConversation);
  document.getElementById('skip-countdown').addEventListener('click', () => conversationController.skipDelay());
  document.getElementById('set-avg-delay').addEventListener('click', () => {
    const avgText = document.getElementById('avg-delay-val').textContent;
    const avg = parseInt(avgText, 10);
    if (avg > 0) {
      const input = document.getElementById('turn-delay');
      if (input) {
        input.value = avg;
        // Update controller live if possible, or just next turn
        conversationController.turnDelay = avg * 1000;
        console.log('[ConversationMode] Updated turn delay to', avg, 'seconds');
      }
    }
  });
  document.getElementById('export-conversation').addEventListener('click', exportConversation);
  document.getElementById('clear-transcript').addEventListener('click', clearTranscript);

  console.log('[ConversationMode] Event listeners set up');
}

// ======================== END CONVERSATION MODE ========================

// Expose for debugging
window.getLastResponse = getLastResponse;
window.toggleFocus = toggleFocus;
window.exitFocus = exitFocus;
window.getAllResponses = getAllResponses;
window.copyResponse = copyResponse;
window.crossCompare = crossCompare;
window.compareAll = compareAll;
window.evaluateYesNo = evaluateYesNo;

promptInput.focus();
// init(); // Don't call directly, wait for signal from main process

window.electronAPI.onConfigReady(() => {
  console.log('Received config-ready signal from main process. Initializing renderer...');
  init();
});
