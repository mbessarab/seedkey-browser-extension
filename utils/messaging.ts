/**
 * Type-Safe Messaging Protocol
 *
 * Uses @webext-core/messaging for communication
 * between the popup, content scripts, and the background service worker.
 *
 * @see https://webext-core.aklinker1.io/messaging/
 */

import { defineExtensionMessaging } from '@webext-core/messaging';
import type { Challenge, ExtensionState, SeedKeyError } from './types';

// ============================================================================
// Protocol Map (Type-Safe Message Definitions)
// ============================================================================

/**
 * Defines all messages between extension contexts.
 * Each key is the message name, and the value is (payload) => result
 */
interface ProtocolMap {
  // ========== State Management ==========

  /**
   * Get the current extension state
   */
  getState(): ExtensionState;

  // ========== Initialization ==========

  /**
   * Initialize the extension (create or restore)
   * @param seedPhrase — if provided, restore; otherwise create a new one
   */
  initialize(data: {
    seedPhrase?: string;
  }): { success: true; seedPhrase: string } | { success: false; error: SeedKeyError };

  /**
   * Confirm seed phrase backup
   */
  confirmSeedBackup(): { success: boolean };

  /**
   * Get the seed phrase (available only for 5 minutes after creation)
   */
  getSeedPhrase(): { success: true; seedPhrase: string } | { success: false; error: SeedKeyError };

  // ========== Key Operations ==========

  /**
   * Get the public key for a domain
   */
  getPublicKey(data: {
    domain: string;
  }): { success: true; publicKey: string } | { success: false; error: SeedKeyError };

  /**
   * Sign a challenge
   */
  signChallenge(data: {
    domain: string;
    challenge: Challenge;
  }):
    | { success: true; signature: string; publicKey: string }
    | { success: false; error: SeedKeyError };

  /**
   * Sign an arbitrary message
   */
  signMessage(data: {
    domain: string;
    message: string;
  }):
    | { success: true; signature: string; publicKey: string }
    | { success: false; error: SeedKeyError };

  // ========== Reset ==========

  /**
   * Full extension reset
   */
  reset(): { success: boolean };
}

// ============================================================================
// Export Messaging Functions
// ============================================================================

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();

// ============================================================================
// Type Helpers
// ============================================================================

export type MessageType = keyof ProtocolMap;
export type MessagePayload<T extends MessageType> = Parameters<ProtocolMap[T]>[0];
export type MessageResult<T extends MessageType> = ReturnType<ProtocolMap[T]>;
