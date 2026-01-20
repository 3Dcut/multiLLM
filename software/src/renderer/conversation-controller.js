/**
 * Conversation Controller
 *
 * Manages automatic conversations between two LLM services.
 * Implements state machine and orchestrates message flow.
 */

// Response monitor functions will be available via window.ResponseMonitor
// We'll access them directly when needed

// State machine states
const States = {
  IDLE: 'IDLE',
  INITIALIZING: 'INITIALIZING',
  WAITING_FOR_A: 'WAITING_FOR_A',
  WAITING_FOR_B: 'WAITING_FOR_B',
  PROCESSING: 'PROCESSING',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
  COMPLETED: 'COMPLETED'
};

class ConversationController {
  constructor(options = {}) {
    // Service references
    this.serviceA = null;
    this.serviceB = null;

    // Webview references
    this.webviewA = null;
    this.webviewB = null;

    // Configuration
    this.maxTurns = options.maxTurns || 20;
    this.turnDelay = options.turnDelay || 3000; // milliseconds
    this.responseTimeout = options.responseTimeout || 60000; // milliseconds

    // State
    this.state = States.IDLE;
    this.currentTurn = 0;
    this.transcript = [];
    this.lastResponseA = '';
    this.lastResponseB = '';

    // Error handling
    this.retryCount = 0;
    this.maxRetries = 3;
    this.repetitionCount = 0;
    this.lastResponseText = '';

    // Control flags
    this.isPaused = false;
    this.shouldStop = false;

    // Callbacks
    this.onStateChange = options.onStateChange || (() => { });
    this.onTurnComplete = options.onTurnComplete || (() => { });
    this.onError = options.onError || (() => { });
    this.onComplete = options.onComplete || (() => { });
    this.onCountdownUpdate = options.onCountdownUpdate || (() => { }); // ADDED

    console.log('[ConversationController] Initialized with options:', options);
  }

  /**
   * Initialize conversation with two services
   */
  initialize(serviceA, serviceB, webviewA, webviewB) {
    console.log(`[ConversationController] Initializing conversation: ${serviceA.id} <-> ${serviceB.id}`);

    this.serviceA = serviceA;
    this.serviceB = serviceB;
    this.webviewA = webviewA;
    this.webviewB = webviewB;

    this.setState(States.IDLE);
  }

  /**
   * Start conversation with initial prompt
   */
  async start(initialPrompt, roleA = null, roleB = null) {
    if (this.state !== States.IDLE && this.state !== States.COMPLETED) {
      console.warn('[ConversationController] Cannot start - not in IDLE or COMPLETED state');
      return;
    }

    console.log('[ConversationController] Starting conversation with prompt:', initialPrompt);
    if (roleA) console.log('[ConversationController] Role A:', roleA.substring(0, 50) + '...');
    if (roleB) console.log('[ConversationController] Role B:', roleB.substring(0, 50) + '...');

    // Reset state
    this.currentTurn = 0;
    this.transcript = [];
    this.shouldStop = false;
    this.isPaused = false;
    this.retryCount = 0;
    this.repetitionCount = 0;
    this.lastResponseText = '';

    this.setState(States.INITIALIZING);

    try {
      let sentRole = false;

      // Send Role A
      if (roleA && roleA.trim()) {
        console.log('[ConversationController] Sending Role A');
        await this.sendMessage(this.serviceA.id, this.webviewA, roleA);
        sentRole = true;
        await window.ResponseMonitor.sleep(1000); // Short buffer
      }

      // Send Role B
      if (roleB && roleB.trim()) {
        console.log('[ConversationController] Sending Role B');
        await this.sendMessage(this.serviceB.id, this.webviewB, roleB);
        sentRole = true;
        await window.ResponseMonitor.sleep(1000); // Short buffer
      }

      // If roles were sent, wait for countdown
      if (sentRole) {
        console.log('[ConversationController] Roles transmitted. Waiting for countdown...');
        await this.sleepWithCountdown(this.turnDelay, this.onCountdownUpdate);
      }

      // Add initial prompt to transcript
      this.addToTranscript('user', initialPrompt, 0);

      // Send initial prompt to Service A
      await this.sendMessage(this.serviceA.id, this.webviewA, initialPrompt);

      // Start conversation loop
      await this.conversationLoop();
    } catch (error) {
      console.error('[ConversationController] Error starting conversation:', error);
      this.handleError(error);
    }
  }

  /**
   * Main conversation loop
   */
  async conversationLoop() {
    while (!this.shouldStop && this.currentTurn < this.maxTurns) {
      // Check for pause
      while (this.isPaused && !this.shouldStop) {
        await window.ResponseMonitor.sleep(500);
      }

      if (this.shouldStop) break;

      try {
        // Wait for Service A to respond
        this.setState(States.WAITING_FOR_A);
        const responseA = await this.waitAndExtractResponse(
          this.serviceA.id,
          this.webviewA,
          this.serviceA
        );

        if ((responseA === null || typeof responseA === 'undefined') || this.shouldStop) break;

        this.currentTurn++;
        this.addToTranscript(this.serviceA.id, responseA, this.currentTurn);
        this.lastResponseA = responseA;

        // Check for repetition
        if (this.checkRepetition(responseA)) {
          console.warn('[ConversationController] Repetition detected, stopping conversation');
          break;
        }

        // Notify turn complete
        this.onTurnComplete({
          turn: this.currentTurn,
          speaker: this.serviceA.id,
          message: responseA
        });

        if (this.currentTurn >= this.maxTurns || this.shouldStop) break;

        // Wait delay before next turn (this is the delay between turns, not for response)
        this.setState(States.PROCESSING);
        await window.ResponseMonitor.sleep(1000); // Shorter static delay between turns

        // Send Service A's response to Service B
        await this.sendMessage(this.serviceB.id, this.webviewB, responseA);

        // Wait for Service B to respond
        this.setState(States.WAITING_FOR_B);
        const responseB = await this.waitAndExtractResponse(
          this.serviceB.id,
          this.webviewB,
          this.serviceB
        );

        if ((responseB === null || typeof responseB === 'undefined') || this.shouldStop) break;

        this.currentTurn++;
        this.addToTranscript(this.serviceB.id, responseB, this.currentTurn);
        this.lastResponseB = responseB;

        // Check for repetition
        if (this.checkRepetition(responseB)) {
          console.warn('[ConversationController] Repetition detected, stopping conversation');
          break;
        }

        // Notify turn complete
        this.onTurnComplete({
          turn: this.currentTurn,
          speaker: this.serviceB.id,
          message: responseB
        });

        if (this.currentTurn >= this.maxTurns || this.shouldStop) break;

        // Wait delay before next turn
        this.setState(States.PROCESSING);
        await window.ResponseMonitor.sleep(1000); // Shorter static delay

        // Send Service B's response back to Service A
        await this.sendMessage(this.serviceA.id, this.webviewA, responseB);
      } catch (error) {
        console.error('[ConversationController] Error in conversation loop:', error);

        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          const backoffTime = Math.pow(2, this.retryCount) * 1000; // Exponential backoff
          console.log(`[ConversationController] Retrying in ${backoffTime}ms (attempt ${this.retryCount}/${this.maxRetries})`);
          await window.ResponseMonitor.sleep(backoffTime);
          continue;
        } else {
          this.handleError(error);
          break;
        }
      }
    }

    // Conversation ended
    this.setState(States.COMPLETED);
    this.onComplete({
      turns: this.currentTurn,
      transcript: this.transcript
    });

    console.log('[ConversationController] Conversation completed');
  }

  /**
   * Send message to a service
   */
  async sendMessage(serviceId, webview, message) {
    console.log(`[ConversationController] Sending message to ${serviceId}:`, message.substring(0, 100));

    const service = serviceId === this.serviceA.id ? this.serviceA : this.serviceB;

    // Use existing injection logic from renderer.js
    const injectionScript = this.createInjectionScript(service, message);

    try {
      const result = await webview.executeJavaScript(injectionScript);
      console.log(`[ConversationController] Message sent to ${serviceId} via ${result.method}`);
      return result;
    } catch (error) {
      console.error(`[ConversationController] Error sending message to ${serviceId}:`, error);
      throw error;
    }
  }

  // ADDED
  /**
   * Sleep function that triggers a countdown callback
   */
  async sleepWithCountdown(duration, tickCallback) {
    let remaining = Math.ceil(duration / 1000);
    tickCallback(remaining); // Initial display

    const interval = setInterval(() => {
      remaining--;
      if (remaining >= 0) {
        tickCallback(remaining);
      }
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    await window.ResponseMonitor.sleep(duration);
    clearInterval(interval); // Ensure cleared in case of timing mismatch
    tickCallback(0); // Final clear
  }

  /**
   * Wait for response and extract it
   */
  async waitAndExtractResponse(serviceId, webview, service) {
    const waitDuration = this.turnDelay; // Using the main delay for waiting
    console.log(`[ConversationController] Waiting for fixed delay for ${serviceId}: ${waitDuration}ms`);

    try {
      // Use sleep with countdown
      await this.sleepWithCountdown(waitDuration, this.onCountdownUpdate);

      console.log(`[ConversationController] Fixed delay finished for ${serviceId}. Extracting response.`);

      // Extract response text
      const responseText = await this.extractResponse(webview, service);

      if (responseText === null || typeof responseText === 'undefined') {
        throw new Error(`Extracted null or undefined response from ${serviceId}.`);
      }

      console.log(`[ConversationController] Extracted response from ${serviceId}:`, responseText.substring(0, 100));

      // Reset retry count on success
      this.retryCount = 0;

      return responseText;
    } catch (error) {
      console.error(`[ConversationController] Error waiting for response from ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Extract response text from webview
   */
  async extractResponse(webview, service) {
    const script = `
      (function() {
        const selectors = ${JSON.stringify(service.responseSelectors)};
        let responseText = '';
        // Use the last selector that matches, and get text from the last element found.
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            // Instead of combining all, get the last element's text.
            const lastElement = elements[elements.length - 1];
            if (lastElement) {
              responseText = lastElement.textContent;
            }
          }
        }
        return responseText.trim();
      })();
    `;

    return await webview.executeJavaScript(script);
  }

  /**
   * Create injection script for sending messages
   * (Uses the robust version from renderer.js)
   */
  createInjectionScript(service, text) {
    const escapedText = text.replace(/\\/g, '\\\\').replace(/`/g, '\`').replace(/\$/g, '\\$');
    const editorType = service.editorType || 'default';

    // Helper functions to be injected, same as in renderer.js
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
        
        console.log('[${service.id}] Starting conversation injection...');

        ${findElementFn(service.id, true)}
        ${insertTextFn(service.id, editorType)}

        let inputEl = findElement(inputSelectors);
        if (!inputEl) {
          ${wait(1500)}
          inputEl = findElement(inputSelectors);
        }

        if (!inputEl) {
          console.error('[${service.id}] Input not found for conversation!');
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

  /**
   * Check for repetitive responses
   */
  checkRepetition(responseText) {
    const normalized = responseText.trim().toLowerCase();

    if (normalized === this.lastResponseText) {
      this.repetitionCount++;
      if (this.repetitionCount >= 3) {
        return true; // Stop conversation
      }
    } else {
      this.repetitionCount = 0;
    }

    this.lastResponseText = normalized;
    return false;
  }

  /**
   * Pause conversation
   */
  pause() {
    console.log('[ConversationController] Pausing conversation');
    this.isPaused = true;
    this.setState(States.PAUSED);
  }

  /**
   * Resume conversation
   */
  resume() {
    console.log('[ConversationController] Resuming conversation');
    this.isPaused = false;

    // Restore previous state
    if (this.currentTurn % 2 === 0) {
      this.setState(States.WAITING_FOR_A);
    } else {
      this.setState(States.WAITING_FOR_B);
    }
  }

  /**
   * Stop conversation
   */
  stop() {
    console.log('[ConversationController] Stopping conversation');
    this.shouldStop = true;
    this.setState(States.COMPLETED);
  }

  /**
   * Add message to transcript
   */
  addToTranscript(speaker, message, turn) {
    this.transcript.push({
      timestamp: new Date().toISOString(),
      speaker: speaker,
      message: message,
      turn: turn
    });

    // Auto-save transcript
    this.saveTranscript();
  }

  /**
   * Save transcript to file
   */
  saveTranscript() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const transcriptData = {
        serviceA: this.serviceA ? this.serviceA.id : null,
        serviceB: this.serviceB ? this.serviceB.id : null,
        startTime: this.transcript.length > 0 ? this.transcript[0].timestamp : null,
        endTime: this.transcript.length > 0 ? this.transcript[this.transcript.length - 1].timestamp : null,
        turns: this.currentTurn,
        messages: this.transcript
      };

      window.electronAPI.writeFile('conversation-history.json', JSON.stringify(transcriptData, null, 2))
        .catch(error => console.error('[ConversationController] Error saving transcript:', error));
    }
  }

  /**
   * Export transcript in various formats
   */
  async exportTranscript(format = 'json') {
    const transcriptData = {
      serviceA: this.serviceA.id,
      serviceB: this.serviceB.id,
      startTime: this.transcript[0].timestamp,
      endTime: this.transcript[this.transcript.length - 1].timestamp,
      turns: this.currentTurn,
      messages: this.transcript
    };

    let content = '';
    let filename = `conversation-${Date.now()}`;

    if (format === 'json') {
      content = JSON.stringify(transcriptData, null, 2);
      filename += '.json';
    } else if (format === 'txt') {
      content = this.transcript.map(entry => {
        return `[${entry.timestamp}] ${entry.speaker}:
${entry.message}
`;
      }).join('\n---\n\n');
      filename += '.txt';
    } else if (format === 'markdown') {
      content = `# Conversation: ${this.serviceA.name} ↔ ${this.serviceB.name}\n\n`;
      content += `**Start:** ${transcriptData.startTime}\n`;
      content += `**End:** ${transcriptData.endTime}\n`;
      content += `**Turns:** ${transcriptData.turns}\n\n`;
      content += `---\n\n`;

      this.transcript.forEach(entry => {
        content += `## Turn ${entry.turn}: ${entry.speaker}\n`;
        content += `*${entry.timestamp}*\n\n`;
        content += `${entry.message}\n\n`;
        content += `---\n\n`;
      });

      filename += '.md';
    }

    return { content, filename };
  }

  /**
   * Set state and notify
   */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    console.log(`[ConversationController] State: ${oldState} -> ${newState}`);
    this.onStateChange(newState, oldState);

    // ADDED: Clear countdown when not waiting
    if (newState !== States.WAITING_FOR_A && newState !== States.WAITING_FOR_B) {
      this.onCountdownUpdate(0);
    }
  }

  /**
   * Handle error
   */
  handleError(error) {
    console.error('[ConversationController] Error:', error);
    this.setState(States.ERROR);
    this.onError(error);
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }

  /**
   * Get transcript
   */
  getTranscript() {
    return this.transcript;
  }

  /**
   * Get conversation stats
   */
  getStats() {
    return {
      state: this.state,
      currentTurn: this.currentTurn,
      maxTurns: this.maxTurns,
      messageCount: this.transcript.length,
      isPaused: this.isPaused
    };
  }
}

// Export for use in renderer (make globally available)
window.ConversationController = ConversationController;
window.ConversationStates = States;