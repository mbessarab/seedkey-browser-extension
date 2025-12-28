/**
 * Uses Zod for runtime validation and TypeScript for static typing.
 */

import { z } from 'zod';

// ============================================================================
// Cryptography
// ============================================================================

export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

// ============================================================================
// Challenge-Response Schema (Zod Validation)
// ============================================================================

export const ChallengeSchema = z.object({
  nonce: z.string().min(1),
  timestamp: z.number().int().positive(),
  domain: z.string().min(1),
  action: z.enum(['register', 'authenticate']),
  expiresAt: z.number().int().positive(),
});

export type Challenge = z.infer<typeof ChallengeSchema>;

// ============================================================================
// Storage
// ============================================================================

export interface EncryptedData {
  iv: string; // base64
  data: string; // base64 encrypted
  salt: string; // base64
}

export interface StorageSettings {
  autoPrompt: boolean;
  theme: 'light' | 'dark' | 'system';
}

// ============================================================================
// Extension State
// ============================================================================

export interface ExtensionState {
  initialized: boolean;
  seedPhrase?: string; // Only temporarily during initialization
  seedPhraseAvailable?: boolean; // true if the seed phrase is available to display
  createdAt?: number; // Identity creation time (timestamp)
  settings: StorageSettings;
}

// ============================================================================
// Error Codes
// ============================================================================

export const ErrorCodes = {
  // Extension errors
  EXTENSION_NOT_FOUND: 'EXTENSION_NOT_FOUND',
  NOT_INITIALIZED: 'NOT_INITIALIZED',

  // User actions
  USER_REJECTED: 'USER_REJECTED',

  // Validation errors
  INVALID_CHALLENGE: 'INVALID_CHALLENGE',
  CHALLENGE_EXPIRED: 'CHALLENGE_EXPIRED',
  DOMAIN_MISMATCH: 'DOMAIN_MISMATCH',
  NONCE_ALREADY_USED: 'NONCE_ALREADY_USED', 

  // Crypto errors
  INVALID_SEED: 'INVALID_SEED',
  ENCRYPTION_ERROR: 'ENCRYPTION_ERROR',
  DECRYPTION_ERROR: 'DECRYPTION_ERROR',

  // Identity errors
  USER_EXISTS: 'USER_EXISTS',

  // Security errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED', 
  SESSION_EXPIRED: 'SESSION_EXPIRED', 

  // Internal
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNKNOWN_ACTION: 'UNKNOWN_ACTION',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface SeedKeyError {
  code: ErrorCode;
  message: string;
}

// ============================================================================
// SDK Types
// ============================================================================

export type SeedKeyAction =
  | 'check_available'
  | 'is_initialized'
  | 'get_public_key'
  | 'sign_challenge'
  | 'sign_message';

export interface SeedKeyRequest {
  type: 'SEEDKEY_REQUEST';
  action: SeedKeyAction;
  requestId: string;
  origin: string;
  payload?: {
    message?: string;
    challenge?: Challenge;
    userId?: string;
  };
}

export interface SeedKeyResponse {
  type: 'SEEDKEY_RESPONSE';
  requestId: string;
  success: boolean;
  result?: unknown;
  error?: SeedKeyError;
}
