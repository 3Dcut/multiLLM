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
    this.onStateChange = options.onStateChange || (() => {});
    this.onTurnComplete = options.onTurnComplete || (() => {});
    this.onError = options.onError || (() => {});
    this.onComplete = options.onComplete || (() => {});

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
  async start(initialPrompt) {
    if (this.state !== States.IDLE && this.state !== States.COMPLETED) {
      console.warn('[ConversationController] Cannot start - not in IDLE or COMPLETED state');
      return;
    }

    console.log('[ConversationController] Starting conversation with prompt:', initialPrompt);

    // Reset state
    this.currentTurn = 0;
    this.transcript = [];
    this.shouldStop = false;
    this.isPaused = false;
    this.retryCount = 0;
    this.repetitionCount = 0;
    this.lastResponseText = '';

    this.setState(States.INITIALIZING);

    // Add initial prompt to transcript
    this.addToTranscript('user', initialPrompt, 0);

    try {
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

        if (!responseA || this.shouldStop) break;

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

        // Wait delay before next turn
        this.setState(States.PROCESSING);
        await window.ResponseMonitor.sleep(this.turnDelay);

        // Send Service A's response to Service B
        await this.sendMessage(this.serviceB.id, this.webviewB, responseA);

        // Wait for Service B to respond
        this.setState(States.WAITING_FOR_B);
        const responseB = await this.waitAndExtractResponse(
          this.serviceB.id,
          this.webviewB,
          this.serviceB
        );

        if (!responseB || this.shouldStop) break;

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
        await window.ResponseMonitor.sleep(this.turnDelay);

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

  /**
   * Wait for response and extract it
   */
  async waitAndExtractResponse(serviceId, webview, service) {
    console.log(`[ConversationController] Waiting for response from ${serviceId}`);

    try {
      // Wait for response to complete
      const detectionResult = await window.ResponseMonitor.waitForResponse(webview, service, this.responseTimeout);

      if (!detectionResult.success) {
        console.warn(`[ConversationController] Response detection failed for ${serviceId}: ${detectionResult.method}`);
      }

      // Extract response text
      const responseText = await this.extractResponse(webview, service);

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
        const responses = [];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            const lastElement = elements[elements.length - 1];
            responses.push(lastElement.textContent.trim());
          }
        }

        return responses.length > 0 ? responses[responses.length - 1] : '';
      })();
    `;

    return await webview.executeJavaScript(script);
  }

  /**
   * Create injection script for sending messages
   * (Adapted from renderer.js)
   */
  createInjectionScript(service, text) {
    return `
      (async function() {
        const editorType = "${service.editorType}";
        const inputSelectors = ${JSON.stringify(service.inputSelectors)};
        const submitSelectors = ${JSON.stringify(service.submitSelectors)};
        const text = ${JSON.stringify(text)};

        // Find input element
        let inputElement = null;
        for (const selector of inputSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            inputElement = elements[elements.length - 1];
            break;
          }
        }

        if (!inputElement) {
          return { success: false, error: 'Input element not found' };
        }

        // Insert text based on editor type
        if (editorType === 'prosemirror') {
          inputElement.focus();
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(inputElement);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
          document.execCommand('insertText', false, text);
        } else if (editorType === 'quill') {
          inputElement.focus();
          document.execCommand('insertText', false, text);
        } else if (editorType === 'lexical') {
          inputElement.focus();
          document.execCommand('insertText', false, text);
        } else {
          // Default: textarea or contenteditable
          if (inputElement.tagName.toLowerCase() === 'textarea' || inputElement.tagName.toLowerCase() === 'input') {
            inputElement.value = text;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            inputElement.textContent = text;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }

        // Wait a bit for the input to register
        await new Promise(resolve => setTimeout(resolve, 500));

        // Find and click submit button
        let submitButton = null;
        for (const selector of submitSelectors) {
          const buttons = document.querySelectorAll(selector);
          for (const btn of buttons) {
            const style = window.getComputedStyle(btn);
            if (style.display !== 'none' && style.visibility !== 'hidden' && !btn.disabled) {
              submitButton = btn;
              break;
            }
          }
          if (submitButton) break;
        }

        if (submitButton) {
          submitButton.click();
          return { success: true, method: 'button' };
        } else {
          // Fallback: press Enter
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true
          });
          inputElement.dispatchEvent(enterEvent);
          return { success: true, method: 'enter' };
        }
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
        return `[${entry.timestamp}] ${entry.speaker}:\n${entry.message}\n`;
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
