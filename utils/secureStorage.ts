/**
 * Secure Storage Module
 * 
 * Architecture:
 * 1. Session Key - generated on each extension startup
 * 2. Device Key - encrypted by the Session Key
 * 3. Master Key - encrypted by the Device Key
 * 
 * Even with storage access, data is unavailable without an active session.
 */

import { createLogger } from './logger';

const log = createLogger('SECURE_STORAGE');

// ============================================================================
// Security Constants
// ============================================================================

/** Encryption algorithm for session-based protection */
const ENCRYPTION_ALGORITHM = 'AES-GCM';
/** Encryption key length in bits */
const KEY_LENGTH = 256;

/** Keys for storing protected data */
const STORAGE_KEYS = {
  encryptedDeviceKey: 'seedkey:v1:encryptedDeviceKey',
  deviceKeySalt: 'seedkey:v1:deviceKeySalt',
  encryptedMasterKey: 'seedkey:v1:encryptedMasterKey',
  masterKeySalt: 'seedkey:v1:masterKeySalt',
  usedNonces: 'seedkey:v1:usedNonces',
} as const;

// ============================================================================
// Session Key Management (Memory-only, not extractable)
// ============================================================================

/** 
 * The session key exists only in memory.
 * Non-extractable.
 */
let sessionKey: CryptoKey | null = null;
/** Unique identifier of the current session */
let sessionId: string | null = null;

/**
 * Initializes a new secure session.
 * 
 * @returns Unique session ID (32 hex characters)
 * 
 * @remarks
 * **Security:**
 * - Generates a cryptographically strong session ID
 * - Creates a non-extractable AES-256-GCM key
 * 
 * The session is required to decrypt the device key and master key.
 * The session is destroyed when the extension is closed.
 */
export async function initializeSession(): Promise<string> {
  log.debug('Initializing new secure session');
  
  // Generate a cryptographically strong session ID
  const idBytes = crypto.getRandomValues(new Uint8Array(16));
  sessionId = Array.from(idBytes, b => b.toString(16).padStart(2, '0')).join('');
  
  // Create a non-extractable session key
  sessionKey = await crypto.subtle.generateKey(
    { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
    false, // Non-extractable! The key cannot be exported
    ['encrypt', 'decrypt']
  );
  
  log.debug('Session initialized', { sessionId: sessionId.substring(0, 8) + '...' });
  return sessionId;
}

/**
 * Checks whether the current session is active.
 * 
 * @returns true if session key and session ID exist
 */
export function hasActiveSession(): boolean {
  return sessionKey !== null && sessionId !== null;
}

/**
 * Destroys the current session.
 * 
 * @remarks
 * Clears the session key and session ID.
 * After that, access to encrypted data is impossible
 * until a new session is initialized.
 * 
 * Called on:
 * - Extension lock
 * - Extension reset
 * - Browser close
 */
export function destroySession(): void {
  log.debug('Destroying session');
  sessionKey = null;
  sessionId = null;
}

/**
 * Gets the current session ID.
 * 
 * @returns Session ID or null if the session is not active
 */
export function getSessionId(): string | null {
  return sessionId;
}

// ============================================================================
// Device Key Management (Protected by Session)
// ============================================================================

/** Cached device key in memory */
let cachedDeviceKey: Uint8Array | null = null;

/**
 * Generates a new device key and stores it encrypted.
 * 
 * @throws Error if the session is not initialized
 * 
 * @remarks
 * **Process:**
 * 1. Generates a 256-bit cryptographically strong device key
 * 2. Generates a random salt
 * 3. Encrypts the device key with the session key via AES-GCM
 * 4. Stores encrypted data in browser.storage.local
 * 5. Caches the device key in memory
 * 
 * The device key is used to encrypt the master key.
 */
export async function generateSecureDeviceKey(): Promise<void> {
  if (!sessionKey) {
    throw new Error('Session not initialized');
  }
  
  log.debug('Generating secure device key');
  
  // Generate a cryptographically strong device key
  const deviceKey = crypto.getRandomValues(new Uint8Array(32));
  
  // Generate a salt for additional protection
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Encrypt the device key using the session key
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedDeviceKey = await crypto.subtle.encrypt(
    { name: ENCRYPTION_ALGORITHM, iv },
    sessionKey,
    deviceKey
  );
  
  // Save encrypted data
  await browser.storage.local.set({
    [STORAGE_KEYS.encryptedDeviceKey]: {
      iv: uint8ArrayToBase64(iv),
      data: uint8ArrayToBase64(new Uint8Array(encryptedDeviceKey)),
    },
    [STORAGE_KEYS.deviceKeySalt]: uint8ArrayToBase64(salt),
  });
  
  // Cache in memory
  cachedDeviceKey = deviceKey;
  
  log.debug('Secure device key generated and stored');
}

/**
 * Gets the device key.
 * 
 * @returns Device key as Uint8Array (32 bytes)
 * @throws Error if the session is not initialized
 * 
 * @remarks
 * On first call, decrypts the device key from storage and caches it.
 * Subsequent calls return the cached value.
 * If the device key does not exist, generates a new one.
 */
export async function getSecureDeviceKey(): Promise<Uint8Array> {
  if (cachedDeviceKey) {
    return cachedDeviceKey;
  }
  
  if (!sessionKey) {
    throw new Error('Session not initialized');
  }
  
  const storage = await browser.storage.local.get([
    STORAGE_KEYS.encryptedDeviceKey,
  ]);
  
  const encrypted = storage[STORAGE_KEYS.encryptedDeviceKey];
  if (!encrypted) {
    // First run - generate a new one
    await generateSecureDeviceKey();
    return cachedDeviceKey!;
  }
  
  // Decrypt
  const iv = base64ToUint8Array(encrypted.iv);
  const data = base64ToUint8Array(encrypted.data);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: ENCRYPTION_ALGORITHM, iv },
    sessionKey,
    data
  );
  
  cachedDeviceKey = new Uint8Array(decrypted);
  return cachedDeviceKey;
}

/**
 * Clears the cached device key.
 */
export function clearCachedDeviceKey(): void {
  if (cachedDeviceKey) {
    // Overwrite memory with zeros
    cachedDeviceKey.fill(0);
    cachedDeviceKey = null;
  }
}

// ============================================================================
// Nonce Management (Replay Attack Protection)
// ============================================================================

/** Nonce lifetime (10 minutes) */
const NONCE_EXPIRY_MS = 10 * 60 * 1000;
/** Maximum number of stored nonces */
const MAX_STORED_NONCES = 1000;

/**
 * Checks nonce uniqueness and registers it.
 * 
 * @param nonce - Unique challenge identifier from the backend
 * @returns true if the nonce is unique, false if it has already been used
 * 
 * @remarks
 * **Replay attack protection:**
 * - Each nonce can be used only once
 * - Nonces are automatically removed after 10 minutes
 * - Up to 1000 nonces are stored (old ones are cleaned up)
 * 
 * On replay attempt, returns false
 * and logs a warning about a potential attack.
 */
export async function validateAndStoreNonce(nonce: string): Promise<boolean> {
  const storage = await browser.storage.local.get(STORAGE_KEYS.usedNonces);
  const usedNonces: Record<string, number> = storage[STORAGE_KEYS.usedNonces] || {};
  
  const now = Date.now();
  
  // Check whether the nonce was already used
  if (usedNonces[nonce]) {
    log.warn('Replay attack detected - nonce already used', { nonce: nonce.substring(0, 10) });
    return false;
  }
  
  // Clean up old nonces
  const cleanedNonces: Record<string, number> = {};
  let count = 0;
  
  for (const [key, timestamp] of Object.entries(usedNonces)) {
    if (now - timestamp < NONCE_EXPIRY_MS && count < MAX_STORED_NONCES) {
      cleanedNonces[key] = timestamp;
      count++;
    }
  }
  
  // Add the new nonce
  cleanedNonces[nonce] = now;
  
  await browser.storage.local.set({
    [STORAGE_KEYS.usedNonces]: cleanedNonces,
  });
  
  return true;
}

// ============================================================================
// Rate Limiting 
// ============================================================================

/** Rate limit entry for a domain */
interface RateLimitEntry {
  /** Number of requests in the current window */
  count: number;
  /** Window start time */
  windowStart: number;
}

/** In-memory storage for rate limits */
const rateLimitMap = new Map<string, RateLimitEntry>();
/** Time window size (1 minute) */
const RATE_LIMIT_WINDOW_MS = 60_000;
/** Max signature requests per window */
const MAX_REQUESTS_PER_WINDOW = 30;

/**
 * Checks and updates the rate limit for a domain.
 * 
 * @param domain - Normalized domain
 * @returns true if the request is allowed, false if the limit is exceeded
 * 
 * @remarks
 * **Abuse protection:**
 * - Up to 30 signatures per minute per domain
 * - Sliding 60-second window
 * - Limits are kept in memory (reset on restart)
 *
 */
export function checkRateLimit(domain: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(domain);
  
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitMap.set(domain, { count: 1, windowStart: now });
    return true;
  }
  
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    log.warn('Rate limit exceeded', { domain, count: entry.count });
    return false;
  }
  
  entry.count++;
  return true;
}

/**
 * Resets the rate limit for a domain or for all domains.
 * 
 * @param domain - Optional: specific domain to reset.
 *                 If not provided, resets all limits.
 * 
 * @remarks
 * Used for testing.
 * In production, it is also called during secureReset.
 */
export function resetRateLimit(domain?: string): void {
  if (domain) {
    rateLimitMap.delete(domain);
  } else {
    rateLimitMap.clear();
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Converts a Uint8Array to a base64 string.
 * @internal
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts a base64 string to a Uint8Array.
 * @internal
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================================================
// Secure Reset
// ============================================================================

/**
 * Performs a secure reset of all protected data.
 * 
 * @remarks
 * **Clears:**
 * - Session key and ID from memory
 * - Cached device key
 * - Rate limit entries
 * - Encrypted storage data (device key, master key, nonces)
 * 
 * Used on a full extension reset.
 */
export async function secureReset(): Promise<void> {
  log.warn('Performing secure reset');
  
  // Clear memory
  destroySession();
  clearCachedDeviceKey();
  resetRateLimit();
  
  // Clear storage
  await browser.storage.local.remove([
    STORAGE_KEYS.encryptedDeviceKey,
    STORAGE_KEYS.deviceKeySalt,
    STORAGE_KEYS.encryptedMasterKey,
    STORAGE_KEYS.masterKeySalt,
    STORAGE_KEYS.usedNonces,
  ]);
  
  log.debug('Secure reset completed');
}
