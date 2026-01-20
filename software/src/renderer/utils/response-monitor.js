/**
 * Response Monitor Module
 *
 * Provides multi-strategy response detection for LLM services.
 * Monitors webviews to determine when a response has been fully generated.
 */

/**
 * Waits for a response to complete in a webview using multiple detection strategies
 *
 * @param {Electron.WebviewTag} webview - The webview element to monitor
 * @param {Object} service - Service configuration object
 * @param {number} timeout - Maximum wait time in milliseconds (default: 60000)
 * @returns {Promise<{success: boolean, method: string, duration: number}>}
 */
async function waitForResponse(webview, service, timeout = 60000) {
  const startTime = Date.now();

  console.log(`[ResponseMonitor] Starting response detection for ${service.id}`);

  try {
    const result = await Promise.race([
      // Strategy A: Watch typing indicator
      watchTypingIndicator(webview, service),

      // Strategy B: Monitor DOM stability
      watchDOMStability(webview, service),

      // Strategy C: Watch streaming complete button
      watchStreamingComplete(webview, service),

      // Strategy D: Fallback timeout
      timeoutFallback(timeout)
    ]);

    const duration = Date.now() - startTime;
    console.log(`[ResponseMonitor] Response detected via ${result.method} after ${duration}ms`);

    return {
      success: result.method !== 'timeout',
      method: result.method,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ResponseMonitor] Error detecting response:`, error);

    return {
      success: false,
      method: 'error',
      duration,
      error: error.message
    };
  }
}

/**
 * Strategy A: Watches for typing indicator to disappear
 * Monitors for elements that indicate the AI is still "typing"
 */
function watchTypingIndicator(webview, service) {
  return new Promise((resolve) => {
    if (!service.typingIndicatorSelectors || service.typingIndicatorSelectors.length === 0) {
      // Strategy not applicable for this service, return a pending promise
      return new Promise(() => {});
    }

    const checkInterval = 500; // Check every 500ms
    let consecutiveAbsent = 0;
    const requiredAbsent = 2; // Must be absent for 2 consecutive checks

    const interval = setInterval(async () => {
      try {
        const script = `
          (function() {
            const selectors = ${JSON.stringify(service.typingIndicatorSelectors)};
            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              for (const el of elements) {
                // Check if element is visible
                const style = window.getComputedStyle(el);
                if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                  return true; // Typing indicator is visible
                }
              }
            }
            return false; // No visible typing indicator
          })();
        `;

        const isTyping = await webview.executeJavaScript(script);

        if (!isTyping) {
          consecutiveAbsent++;
          if (consecutiveAbsent >= requiredAbsent) {
            clearInterval(interval);
            resolve({ method: 'typing-indicator' });
          }
        } else {
          consecutiveAbsent = 0;
        }
      } catch (error) {
        console.error('[ResponseMonitor] Error in typing indicator check:', error);
      }
    }, checkInterval);
  });
}

/**
 * Strategy B: Monitors DOM stability
 * Waits until the response text stops changing for a specified duration
 */
function watchDOMStability(webview, service) {
  return new Promise((resolve) => {
    const stabilityWait = service.responseStabilityWait || 2000;
    const checkInterval = 300;
    let lastResponseText = '';
    let lastChangeTime = Date.now();

    const interval = setInterval(async () => {
      try {
        const script = `
          (function() {
            const selectors = ${JSON.stringify(service.responseSelectors)};
            let responseText = '';
            // Use the last selector that matches, but combine text from all its elements.
            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              if (elements.length > 0) {
                let combinedText = '';
                for (const el of elements) {
                    combinedText += el.textContent;
                }
                responseText = combinedText;
              }
            }
            return responseText;
          })();
        `;

        const currentText = await webview.executeJavaScript(script);

        if (currentText && currentText !== lastResponseText) {
          lastResponseText = currentText;
          lastChangeTime = Date.now();
        } else if (currentText && (Date.now() - lastChangeTime) >= stabilityWait) {
          // Text has been stable for the required duration
          clearInterval(interval);
          resolve({ method: 'dom-stability' });
        }
      } catch (error) {
        console.error('[ResponseMonitor] Error in DOM stability check:', error);
      }
    }, checkInterval);
  });
}

/**
 * Strategy C: Watches for streaming complete button
 * Monitors for "Stop generating" button to disappear
 */
function watchStreamingComplete(webview, service) {
  return new Promise((resolve) => {
    if (!service.streamingCompleteSelectors || service.streamingCompleteSelectors.length === 0) {
      // Strategy not applicable for this service, return a pending promise
      return new Promise(() => {});
    }

    const checkInterval = 500;
    let wasStreaming = false;

    const interval = setInterval(async () => {
      try {
        const script = `
          (function() {
            const selectors = ${JSON.stringify(service.streamingCompleteSelectors)};
            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              for (const el of elements) {
                // Check if "Stop" button is visible and enabled
                const style = window.getComputedStyle(el);
                if (style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    !el.disabled) {
                  return true; // Still streaming
                }
              }
            }
            return false; // Not streaming
          })();
        `;

        const isStreaming = await webview.executeJavaScript(script);

        if (isStreaming) {
          wasStreaming = true;
        } else if (wasStreaming && !isStreaming) {
          // Was streaming, now stopped
          clearInterval(interval);
          resolve({ method: 'streaming-complete' });
        }
      } catch (error) {
        console.error('[ResponseMonitor] Error in streaming complete check:', error);
      }
    }, checkInterval);
  });
}

/**
 * Strategy D: Fallback timeout
 * Returns after specified timeout as last resort
 */
function timeoutFallback(timeout) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.warn(`[ResponseMonitor] Timeout reached after ${timeout}ms`);
      resolve({ method: 'timeout' });
    }, timeout);
  });
}

/**
 * Utility: Sleep function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export functions for use in renderer (make globally available)
window.ResponseMonitor = {
  waitForResponse,
  watchTypingIndicator,
  watchDOMStability,
  watchStreamingComplete,
  timeoutFallback,
  sleep
};
