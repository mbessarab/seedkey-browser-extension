/**
 * Content Script (ISOLATED WORLD)
 *
 * This script acts as a bridge between the page and the background script.
 *
 * COMMUNICATION:
 * - In Chrome: Can receive CustomEvent directly from main world
 * - In Firefox: Uses inline script injection to bridge main world isolation
 *
 * Firefox isolates content scripts from page context, making CustomEvent.detail
 * inaccessible. We solve this by injecting a bridge script into the main world.
 */

import { sendMessage } from '@/utils/messaging';
import { ChallengeSchema, ErrorCodes, SeedKeyError } from '@/utils/types';
import type { SeedKeyRequest, SeedKeyResponse } from '@/utils/types';
import { createLogger } from '@/utils/logger';
import { EXTENSION_VERSION } from '@/utils/config';

const log = createLogger('CS');

// Event names for communication
const REQUEST_EVENT_V1 = 'seedkey:v1:request';
const RESPONSE_EVENT_V1 = 'seedkey:v1:response';

// postMessage types for bridge communication (Firefox only)
const BRIDGE_REQUEST = 'SEEDKEY_BRIDGE_REQUEST';
const BRIDGE_RESPONSE = 'SEEDKEY_BRIDGE_RESPONSE';

// Detect Firefox
const isFirefox = typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox');

// ============================================================================
// Firefox Bridge Script (injected into main world)
// ============================================================================

/**
 * Bridge script code that runs in main world.
 * Listens for SDK CustomEvents and forwards them via postMessage.
 */
const BRIDGE_SCRIPT_CODE = `
(function() {
  const REQUEST_EVENT = 'seedkey:v1:request';
  const RESPONSE_EVENT = 'seedkey:v1:response';
  const BRIDGE_REQUEST = 'SEEDKEY_BRIDGE_REQUEST';
  const BRIDGE_RESPONSE = 'SEEDKEY_BRIDGE_RESPONSE';

  // Listen for SDK requests (CustomEvent in main world)
  document.addEventListener(REQUEST_EVENT, function(event) {
    const detail = event.detail;
    if (!detail || !detail.action) return;

    // Forward to content script via postMessage
    window.postMessage({
      type: BRIDGE_REQUEST,
      payload: JSON.parse(JSON.stringify(detail))
    }, '*');
  });

  // Listen for responses from content script
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== BRIDGE_RESPONSE) return;

    const response = event.data.response;
    if (!response) return;

    // Dispatch response back to SDK via CustomEvent
    document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
      detail: response,
      bubbles: true
    }));
  });
})();
`;

/**
 * Inject bridge script into the main world (for Firefox).
 * This script runs in the page context and can access CustomEvent.detail.
 */
function injectBridgeScript(): void {
    try {
        const script = document.createElement('script');
        script.textContent = BRIDGE_SCRIPT_CODE;
        (document.head || document.documentElement).appendChild(script);
        script.remove(); // Clean up after execution
        log.debug('Bridge script injected into main world');
    } catch (error) {
        log.error('Failed to inject bridge script', error);
    }
}

// ============================================================================
// Content Script Definition
// ============================================================================

/**
 * Safely extracts event detail from CustomEvent.
 * Works in Chrome, may fail in Firefox (which uses bridge instead).
 */
function safeGetEventDetail(event: CustomEvent<SeedKeyRequest>): SeedKeyRequest | null {
    try {
        const detail = event.detail;
        if (detail && typeof detail === 'object') {
            return JSON.parse(JSON.stringify(detail));
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Send response back to the page.
 * Uses postMessage for Firefox (via bridge), CustomEvent for Chrome.
 */
function sendResponseToPage(
    requestId: string,
    result: { success: boolean; result?: unknown; error?: SeedKeyError }
): void {
    const response: SeedKeyResponse = {
        type: 'SEEDKEY_RESPONSE',
        requestId,
        success: result.success,
        result: result.result,
        error: result.error,
    };

    if (isFirefox) {
        // Send via postMessage to bridge script in main world
        window.postMessage({
            type: BRIDGE_RESPONSE,
            response,
        }, '*');
    } else {
        // Chrome: dispatch CustomEvent directly
        const event = new CustomEvent(RESPONSE_EVENT_V1, { detail: response, bubbles: true });
        document.dispatchEvent(event);
    }
}

export default defineContentScript({
    matches: ['<all_urls>'],
    runAt: 'document_start',

    main() {
        log.info('Content script loaded', { url: window.location.href, isFirefox });

        if (isFirefox) {
            // Firefox: Inject bridge script into main world
            injectBridgeScript();

            // Listen for postMessage from bridge script
            window.addEventListener('message', (event) => {
                if (event.source !== window) return;
                if (event.data?.type !== BRIDGE_REQUEST) return;

                const detail = event.data.payload as SeedKeyRequest;
                if (!detail || !detail.action) return;

                log.info('← Received SDK request via bridge', {
                    action: detail.action,
                    requestId: detail.requestId,
                    origin: detail.origin
                });
                handleRequest(detail);
            });
        } else {
            // Chrome: Listen for CustomEvent directly
            document.addEventListener(REQUEST_EVENT_V1, ((event: CustomEvent<SeedKeyRequest>) => {
                const detail = safeGetEventDetail(event);

                if (!detail) {
                    log.error('Failed to get event detail');
                    return;
                }

                log.info('← Received SDK request', {
                    action: detail.action,
                    requestId: detail.requestId,
                    origin: detail.origin
                });
                handleRequest(detail);
            }) as EventListener);
        }

        // Dispatch a "content script ready" event
        log.info('Content script ready, dispatching ready event');
        document.dispatchEvent(new CustomEvent('seedkey:v1:cs-ready', { detail: { version: EXTENSION_VERSION } }));
    },
});

// ============================================================================
// Request Handling
// ============================================================================

/**
 * Handles an incoming request from the SDK on the page.
 *
 * @param request - SeedKeyRequest object with action and payload
 *
 * @remarks
 * Processes the request and sends the response via CustomEvent.
 * On error, returns INTERNAL_ERROR.
 */
function handleRequest(request: SeedKeyRequest): void {
    if (!request || !request.action) {
        return;
    }

    const startTime = performance.now();

    processRequest(request)
        .then((result) => {
            const duration = (performance.now() - startTime).toFixed(2);
            log.debug(`Response in ${duration}ms`, { action: request.action, success: result.success });
            sendResponseToPage(request.requestId, result);
        })
        .catch((error) => {
            log.error('Request failed', error);
            sendResponseToPage(request.requestId, {
                success: false,
                error: {
                    code: ErrorCodes.INTERNAL_ERROR,
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
            });
        });
}

// ============================================================================
// Request Processing
// ============================================================================

/**
 * Routes and processes requests from the SDK.
 * 
 * @param request - Incoming request with action and payload
 * @returns Object with success and result/error
 * 
 * @remarks
 * Supported actions:
 * - `check_available` — checks extension availability
 * - `is_initialized` — checks initialization status
 * - `get_public_key` — gets a public key for the domain
 * - `sign_challenge` — signs a challenge (validated via Zod)
 * - `sign_message` — signs an arbitrary message
 * 
 * For crypto operations, the current page origin is used as the domain.
 */
async function processRequest(
  request: SeedKeyRequest
): Promise<{ success: boolean; result?: unknown; error?: SeedKeyError }> {
  const origin = window.location.origin;

  switch (request.action) {
    case 'check_available':
      return { success: true, result: { available: true, version: EXTENSION_VERSION } };

    case 'is_initialized': {
      const state = await sendMessage('getState', undefined);
      return { success: true, result: { initialized: state.initialized } };
    }

    case 'get_public_key': {
      const result = await sendMessage('getPublicKey', { domain: origin });
      if (result.success) {
        return { success: true, result: { publicKey: result.publicKey } };
      }
      return { success: false, error: result.error };
    }

    case 'sign_challenge': {
      const challenge = request.payload?.challenge;
      if (!challenge) {
        return {
          success: false,
          error: {
            code: ErrorCodes.INVALID_CHALLENGE,
            message: 'Challenge is required for signing',
          },
        };
      }

      // Validate the challenge via Zod
      const validation = ChallengeSchema.safeParse(challenge);
      if (!validation.success) {
        return {
          success: false,
          error: {
            code: ErrorCodes.INVALID_CHALLENGE,
            message: 'Invalid challenge format',
          },
        };
      }

      const result = await sendMessage('signChallenge', {
        domain: origin,
        challenge: validation.data,
      });

      if (result.success) {
        return {
          success: true,
          result: { signature: result.signature, publicKey: result.publicKey },
        };
      }
      return { success: false, error: result.error };
    }

    case 'sign_message': {
      const message = request.payload?.message;
      if (!message) {
        return {
          success: false,
          error: {
            code: ErrorCodes.INVALID_CHALLENGE,
            message: 'Message is required for signing',
          },
        };
      }

      const result = await sendMessage('signMessage', { domain: origin, message });
      if (result.success) {
        return {
          success: true,
          result: { signature: result.signature, publicKey: result.publicKey },
        };
      }
      return { success: false, error: result.error };
    }

    default:
      return {
        success: false,
        error: {
          code: ErrorCodes.UNKNOWN_ACTION,
          message: `Unknown action: ${request.action}`,
        },
      };
  }
}


