/**
 * Content Script
 * 
 * This script acts as a bridge between the page and the background script.
 * 
 * COMMUNICATION:
 * - Uses CustomEvent instead of postMessage for reliable communication
 *   between the main world (page) and the isolated world (content script)
 *   (postMessage can be unreliable)
 */

import { sendMessage } from '@/utils/messaging';
import { ChallengeSchema, ErrorCodes, SeedKeyError } from '@/utils/types';
import type { SeedKeyRequest, SeedKeyResponse, Challenge } from '@/utils/types';
import { createLogger } from '@/utils/logger';
import { EXTENSION_VERSION } from '@/utils/config';

const log = createLogger('CS');

// Event names for communication
const REQUEST_EVENT_V1 = 'seedkey:v1:request';
const RESPONSE_EVENT_V1 = 'seedkey:v1:response';

// ============================================================================
// Content Script Definition
// ============================================================================

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  
  main() {
    log.info('Content script loaded', { url: window.location.href });

    document.addEventListener(REQUEST_EVENT_V1, ((event: CustomEvent<SeedKeyRequest>) => {
      log.info('← Received SDK request', { 
        action: event.detail?.action,
        requestId: event.detail?.requestId,
        origin: event.detail?.origin
      });
      handleRequest(event.detail);
    }) as EventListener);

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
      sendResponse(request.requestId, result);
    })
    .catch((error) => {
      log.error('Request failed', error);
      sendResponse(request.requestId, {
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    });
}

/**
 * Sends an SDK response via CustomEvent.
 * 
 * @param requestId - Unique request ID for correlation
 * @param result - Processing result with success, result, or error
 * 
 * @remarks
 * Uses CustomEvent for communication between the isolated world
 * (content script) and the main world (SDK on the page).
 * The event uses bubbles: true for reliable delivery.
 */
function sendResponse(
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

  // Dispatch the response via CustomEvent
  const event = new CustomEvent(RESPONSE_EVENT_V1, { detail: response, bubbles: true });
  document.dispatchEvent(event);
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

