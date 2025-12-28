/**
 * Background Script
 * 
 * The Service Worker is responsible ONLY for:
 * • Key generation and derivation
 * • Data signing
 * • Secure storage of the Master Key
 *
 */

import { onMessage } from '@/utils/messaging';
import {
  generateSeedPhrase,
  isValidSeedPhrase,
  signChallenge,
  signMessage,
  normalizeDomain,
  deriveMasterKey,
  deriveSiteKey,
  encrypt,
  decrypt,
  uint8ArrayToBase64,
} from '@/utils/crypto';
import {
  encryptedMasterKey,
  isInitialized,
  settings,
  createdAt,
  resetStorage,
} from '@/utils/storage';
import { ChallengeSchema, ErrorCodes } from '@/utils/types';
import type { ExtensionState, Challenge, SeedKeyError } from '@/utils/types';
import { createLogger } from '@/utils/logger';
import { getDeviceKey } from '@/utils/deviceKey';

import {
  initializeSession,
  validateAndStoreNonce,
  checkRateLimit,
  secureReset,
} from '@/utils/secureStorage';

const log = createLogger('BG');

// ============================================================================
// State (with security improvements)
// ============================================================================

// Temporary seed phrase storage (only during initialization)
// Includes an auto-clear timeout
let tempSeedPhrase: string | null = null;
let tempSeedPhraseTimeoutId: ReturnType<typeof setTimeout> | null = null;
const TEMP_SEED_PHRASE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Background Script Entry
// ============================================================================

export default defineBackground(() => {
  log.info('SeedKey Auth Extension started');

  // On extension install
  browser.runtime.onInstalled.addListener((details) => {
    log.info('Extension installed', { reason: details.reason });
  });

  // Register message handlers (@webext-core/messaging)
  registerMessageHandlers();
});

// ============================================================================
// Message Handlers Registration
// ============================================================================

/**
 * Registers all message handlers from the popup and content scripts.
 * Uses @webext-core/messaging for type-safe communication.
 * 
 * @remarks
 * Handlers are grouped into:
 * - State Management: getState
 * - Initialization: initialize, confirmSeedBackup
 * - Key Operations: getPublicKey, signChallenge, signMessage
 * - Reset: reset
 */
function registerMessageHandlers() {
  // ========== State Management ==========

  onMessage('getState', async () => {
    log.debug('getState called');
    return await getExtensionState();
  });

  // ========== Initialization ==========

  onMessage('initialize', async ({ data }) => {
    log.debug('initialize called', { isRestore: !!data.seedPhrase });
    return await initializeExtension(data.seedPhrase);
  });

  onMessage('confirmSeedBackup', async () => {
    log.debug('confirmSeedBackup called');
    return await confirmSeedBackup();
  });

  onMessage('getSeedPhrase', async () => {
    log.debug('getSeedPhrase called');
    return await handleGetSeedPhrase();
  });

  // ========== Key Operations ==========

  onMessage('getPublicKey', async ({ data }) => {
    log.debug('getPublicKey called', { domain: data.domain });
    return await getPublicKey(data.domain);
  });

  onMessage('signChallenge', async ({ data }) => {
    log.debug('signChallenge called', {
      domain: data.domain,
      action: data.challenge?.action,
    });
    return await handleSignChallenge(data.domain, data.challenge);
  });

  onMessage('signMessage', async ({ data }) => {
    log.debug('signMessage called', {
      domain: data.domain,
      messageLength: data.message?.length,
    });
    return await handleSignMessage(data.domain, data.message);
  });

  // ========== Reset ==========

  onMessage('reset', async () => {
    log.debug('reset called');
    return await handleReset();
  });
}

// ============================================================================
// State Management
// ============================================================================

/**
 * Gets the current extension state.
 * 
 * @returns ExtensionState object with initialization info,
 *          sites list, settings, and the temporary seed phrase (if any).
 * 
 * @example
 * const state = await getExtensionState();
 * if (state.initialized) {
 *   console.log('Extension initialized');
 * }
 */
async function getExtensionState(): Promise<ExtensionState> {
  const [initialized, settingsData, identityCreatedAt] = await Promise.all([
    isInitialized.getValue(),
    settings.getValue(),
    createdAt.getValue(),
  ]);

  // Check whether the seed phrase is available (within 5 minutes after creation)
  const seedPhraseAvailable = tempSeedPhrase !== null && 
    identityCreatedAt !== null && 
    Date.now() - identityCreatedAt < TEMP_SEED_PHRASE_TIMEOUT_MS;

  return {
    initialized,
    seedPhrase: tempSeedPhrase ?? undefined,
    seedPhraseAvailable,
    createdAt: identityCreatedAt ?? undefined,
    settings: settingsData,
  };
}

// ============================================================================
// Master Key Management
// ============================================================================

/**
 * Saves the master key encrypted with the device key.
 * 
 * @param seedPhrase - Seed phrase used to derive the master key
 * 
 * @remarks
 * 1. Derives the master key from the seed phrase via PBKDF2-SHA512 (210k iterations)
 * 2. Gets the device key (unique per device/installation)
 * 3. Encrypts the master key using AES-256-GCM
 * 4. Stores encrypted data in browser.storage.local
 * 5. Sets initialized = true
 */
async function saveMasterKey(seedPhrase: string): Promise<void> {
  log.debug('Saving master key');
  const masterKey = await deriveMasterKey(seedPhrase);
  const deviceKey = await getDeviceKey();
  const encrypted = await encrypt(masterKey, deviceKey);
  await encryptedMasterKey.setValue(encrypted);
  await isInitialized.setValue(true);
  log.debug('Master key saved');
}

/**
 * Gets the decrypted master key from storage.
 * 
 * @returns Master key as Uint8Array, or null if the key is not found or decryption fails
 * 
 * @remarks
 * Uses the device key to decrypt the master key from browser.storage.local.
 * On decryption error, returns null and logs the error.
 */
async function getMasterKey(): Promise<Uint8Array | null> {
  const encrypted = await encryptedMasterKey.getValue();
  if (!encrypted) return null;

  try {
    const deviceKey = await getDeviceKey();
    return await decrypt(encrypted, deviceKey);
  } catch (error) {
    log.error('Failed to decrypt master key', error);
    return null;
  }
}

/**
 * Gets a keypair for a specific domain.
 * 
 * @param domain - Website domain for which the keypair is needed
 * @returns Object with privateKey, publicKey and publicKeyBase64, or null on error
 * 
 * @remarks
 * Derives a unique Ed25519 keypair from the master key for each domain
 * via HKDF-SHA256. This provides isolation between sites —
 * compromise of one site does not affect others.
 */
async function getSiteKeyPair(domain: string) {
  const masterKey = await getMasterKey();
  if (!masterKey) return null;

  const keyPair = await deriveSiteKey(masterKey, domain);
  return {
    ...keyPair,
    publicKeyBase64: uint8ArrayToBase64(keyPair.publicKey),
  };
}

// ============================================================================
// Initialization
// ============================================================================

/** Extension initialization result */
type InitResult =
  | { success: true; seedPhrase: string }
  | { success: false; error: SeedKeyError };

/**
 * Initializes the extension — creates a new identity or restores an existing one.
 * 
 * @param seedPhrase - Optional: seed phrase for recovery.
 *                     If not provided, a new one is generated.
 * @returns InitResult with the seed phrase on success, or an error on failure
 * 
 * @remarks
 * Scenarios:
 * 1. **Create a new identity** (seedPhrase not provided):
 *    - Generates a 12-word BIP-39 phrase
 *    - Stores it in temporary storage with an auto-clear timeout (5 minutes)
 *    - The master key is NOT saved until backup is confirmed
 * 
 * 2. **Recovery** (seedPhrase provided):
 *    - Validates the seed phrase via BIP-39
 *    - Saves the master key immediately
 *    - Initializes a secure session
 * 
 * @throws {USER_EXISTS} If the extension is already initialized when creating a new identity
 * @throws {INVALID_SEED} If the provided seed phrase is invalid
 */
async function initializeExtension(seedPhrase?: string): Promise<InitResult> {
  const initialized = await isInitialized.getValue();

  // If already initialized and attempting to create a new one
  if (initialized && !seedPhrase) {
    return {
      success: false,
      error: {
        code: ErrorCodes.USER_EXISTS,
        message: 'Extension is already initialized. Reset first to create new identity.',
      },
    };
  }

  let phrase: string;

  if (seedPhrase) {
    // Restore from an existing phrase
    if (!isValidSeedPhrase(seedPhrase)) {
      return {
        success: false,
        error: {
          code: ErrorCodes.INVALID_SEED,
          message: 'Invalid seed phrase. Please check and try again.',
        },
      };
    }
    phrase = seedPhrase;
  } else {
    // Generate a new phrase
    phrase = generateSeedPhrase();
  }

  setTempSeedPhrase(phrase);

  // If this is a recovery, save immediately
  if (seedPhrase) {
    await saveMasterKey(phrase);
    clearTempSeedPhrase();
    
    await initializeSession();
  }

  return { success: true, seedPhrase: phrase };
}

/**
 * Confirms that the user saved the seed phrase.
 * Finalizes the identity creation process.
 * 
 * @returns {success: boolean} — operation result
 * 
 * @throws Error if there is no temporary seed phrase to confirm
 * 
 * @remarks
 * 1. Saves the master key derived from the temporary seed phrase
 * 2. Stores the creation time to allow 5-minute access to the seed phrase
 * 3. The seed phrase remains available for 5 minutes after confirmation
 * 4. Initializes a secure session
 * 
 * This two-step initialization ensures that the user
 * consciously saved the seed phrase before activating the extension.
 */
async function confirmSeedBackup(): Promise<{ success: boolean }> {
  if (!tempSeedPhrase) {
    throw new Error('No seed phrase to confirm');
  }

  await saveMasterKey(tempSeedPhrase);
  
  // Store creation time to determine seed phrase availability
  await createdAt.setValue(Date.now());
  
  // Do NOT clear the seed phrase immediately - it will be cleared by timeout (5 minutes)
  // This allows the user to view the seed phrase once more after confirmation
  
  await initializeSession();

  return { success: true };
}

/**
 * Gets the seed phrase if it is still available (within 5 minutes after creation).
 * 
 * @returns Seed phrase or error
 */
async function handleGetSeedPhrase(): Promise<
  | { success: true; seedPhrase: string }
  | { success: false; error: SeedKeyError }
> {
  const identityCreatedAt = await createdAt.getValue();
  
  // Check whether 5 minutes have passed
  if (!identityCreatedAt || Date.now() - identityCreatedAt >= TEMP_SEED_PHRASE_TIMEOUT_MS) {
    return {
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Seed phrase display time has expired',
      },
    };
  }
  
  // Check that the seed phrase is present in memory
  if (!tempSeedPhrase) {
    return {
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Seed phrase is no longer available',
      },
    };
  }
  
  return { success: true, seedPhrase: tempSeedPhrase };
}

// ============================================================================
// Key Operations
// ============================================================================

/** Public key retrieval result */
type PublicKeyResult =
  | { success: true; publicKey: string }
  | { success: false; error: SeedKeyError };

/**
 * Gets the public key for the given domain.
 * 
 * @param domain - Website domain (e.g., "example.com")
 * @returns PublicKeyResult with a base64-encoded public key or an error
 * 
 * @remarks
 * - Normalizes the domain (removes www, port, path)
 * - Derives a unique Ed25519 key for the domain
 * - Returns the public key in base64 format
 * 
 * @throws {NOT_INITIALIZED} If the extension is not initialized
 * @throws {DECRYPTION_ERROR} If the site key derivation fails
 */
async function getPublicKey(domain: string): Promise<PublicKeyResult> {
  const initialized = await isInitialized.getValue();
  if (!initialized) {
    return {
      success: false,
      error: {
        code: ErrorCodes.NOT_INITIALIZED,
        message: 'Extension is not initialized',
      },
    };
  }

  const normalizedDomain = normalizeDomain(domain);
  const keyPair = await getSiteKeyPair(normalizedDomain);

  if (!keyPair) {
    return {
      success: false,
      error: {
        code: ErrorCodes.DECRYPTION_ERROR,
        message: 'Failed to derive site key',
      },
    };
  }

  return { success: true, publicKey: keyPair.publicKeyBase64 };
}

// ============================================================================
// Challenge Signing
// ============================================================================

/** Result of signing a challenge or message */
type SignResult =
  | { success: true; signature: string; publicKey: string }
  | { success: false; error: SeedKeyError };

/**
 * Signs a challenge from the backend for authentication.
 * 
 * @param domain - Domain requesting the signature
 * @param challenge - Challenge object from the backend (nonce, timestamp, domain, action, expiresAt)
 * @returns SignResult with base64-encoded signature and public key
 * 
 * @remarks
 * **Multi-layer protection:**
 * 1. Checks extension initialization
 * 2. Rate limiting (max 30 signatures/minute per domain)
 * 3. Validates challenge format via Zod
 * 4. Checks nonce uniqueness (replay attack protection)
 * 5. **Critical:** Verifies request domain matches the challenge domain (anti-phishing)
 * 6. Checks challenge expiration
 * 
 * @throws {NOT_INITIALIZED} Extension is not initialized
 * @throws {INTERNAL_ERROR} Rate limit exceeded
 * @throws {INVALID_CHALLENGE} Invalid format or replayed nonce
 * @throws {DOMAIN_MISMATCH} Request domain does not match the challenge domain
 * @throws {CHALLENGE_EXPIRED} Challenge expired
 * @throws {DECRYPTION_ERROR} Failed to derive key
 */
async function handleSignChallenge(
  domain: string,
  challenge: Challenge
): Promise<SignResult> {
  // Check initialization
  const initialized = await isInitialized.getValue();
  if (!initialized) {
    return {
      success: false,
      error: {
        code: ErrorCodes.NOT_INITIALIZED,
        message: 'Extension is not initialized',
      },
    };
  }

  const normalizedRequestDomain = normalizeDomain(domain);

  // Rate limiting
  if (!checkRateLimit(normalizedRequestDomain)) {
    log.warn('Rate limit exceeded for domain', { domain: normalizedRequestDomain });
    return {
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Rate limit exceeded. Please try again later.',
      },
    };
  }

  // Validate the challenge via Zod
  const validation = ChallengeSchema.safeParse(challenge);
  if (!validation.success) {
    log.error('Invalid challenge format', validation.error);
    return {
      success: false,
      error: {
        code: ErrorCodes.INVALID_CHALLENGE,
        message: 'Invalid challenge format',
      },
    };
  }

  // Check nonce uniqueness (replay attack protection)
  const isValidNonce = await validateAndStoreNonce(challenge.nonce);
  if (!isValidNonce) {
    log.error('Replay attack detected - nonce already used');
    return {
      success: false,
      error: {
        code: ErrorCodes.INVALID_CHALLENGE,
        message: 'Challenge nonce has already been used',
      },
    };
  }

  // Normalize domains for comparison
  const normalizedChallengeDomain = normalizeDomain(challenge.domain);

  // Domain mismatch check — critical for anti-phishing!
  if (normalizedRequestDomain !== normalizedChallengeDomain) {
    log.error('Domain mismatch detected', {
      requestDomain: normalizedRequestDomain,
      challengeDomain: normalizedChallengeDomain,
    });
    return {
      success: false,
      error: {
        code: ErrorCodes.DOMAIN_MISMATCH,
        message: 'Challenge domain does not match request domain',
      },
    };
  }

  // Check challenge expiration
  if (challenge.expiresAt && Date.now() > challenge.expiresAt) {
    return {
      success: false,
      error: {
        code: ErrorCodes.CHALLENGE_EXPIRED,
        message: 'Challenge has expired',
      },
    };
  }

  // Get domain keys
  const keyPair = await getSiteKeyPair(normalizedRequestDomain);
  if (!keyPair) {
    return {
      success: false,
      error: {
        code: ErrorCodes.DECRYPTION_ERROR,
        message: 'Failed to derive site key',
      },
    };
  }

  // Sign the challenge
  const signature = await signChallenge(challenge, keyPair.privateKey);

  return {
    success: true,
    signature,
    publicKey: keyPair.publicKeyBase64,
  };
}

/**
 * Signs an arbitrary message for the specified domain.
 * 
 * @param domain - Domain requesting the signature
 * @param message - Arbitrary text message to sign
 * @returns SignResult with a base64-encoded Ed25519 signature and public key
 * 
 * @remarks
 * Unlike signChallenge, this method does not validate message structure.
 * Used for custom scenarios (signing transactions, documents, etc.).
 * 
 * Rate limiting is applied to prevent abuse.
 * 
 * @throws {NOT_INITIALIZED} Extension is not initialized
 * @throws {INTERNAL_ERROR} Rate limit exceeded
 * @throws {DECRYPTION_ERROR} Failed to derive key
 */
async function handleSignMessage(
  domain: string,
  message: string
): Promise<SignResult> {
  const initialized = await isInitialized.getValue();
  if (!initialized) {
    return {
      success: false,
      error: {
        code: ErrorCodes.NOT_INITIALIZED,
        message: 'Extension is not initialized',
      },
    };
  }

  const normalizedDomain = normalizeDomain(domain);

  // Rate limiting
  if (!checkRateLimit(normalizedDomain)) {
    log.warn('Rate limit exceeded for domain', { domain: normalizedDomain });
    return {
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Rate limit exceeded. Please try again later.',
      },
    };
  }

  const keyPair = await getSiteKeyPair(normalizedDomain);

  if (!keyPair) {
    return {
      success: false,
      error: {
        code: ErrorCodes.DECRYPTION_ERROR,
        message: 'Failed to derive site key',
      },
    };
  }

  const signature = await signMessage(message, keyPair.privateKey);

  return {
    success: true,
    signature,
    publicKey: keyPair.publicKeyBase64,
  };
}

// ============================================================================
// Temp Seed Phrase Management 
// ============================================================================

/**
 * Sets a temporary seed phrase with an auto-clear timeout.
 * 
 * @param phrase - Seed phrase for temporary storage
 * 
 * @remarks
 * **Security:**
 * - Clears the previous phrase before setting a new one
 * - Sets an auto-clear timeout (5 minutes)
 * - The seed phrase is automatically removed from memory when the timeout expires
 * 
 * This prevents a situation where a user creates an identity,
 * does not save the phrase, and forgets about it — it will be cleared after 5 minutes.
 */
function setTempSeedPhrase(phrase: string): void {
  // Clear the previous timeout
  clearTempSeedPhrase();
  
  tempSeedPhrase = phrase;
  
  // Set an auto-clear timeout
  tempSeedPhraseTimeoutId = setTimeout(() => {
    log.warn('Temp seed phrase auto-cleared due to timeout');
    clearTempSeedPhrase();
  }, TEMP_SEED_PHRASE_TIMEOUT_MS);
}

/**
 * Securely clears the temporary seed phrase from memory.
 * 
 * @remarks
 * 1. Cancels the auto-clear timeout (if any)
 * 2. Clears the seed phrase variable
 * 
 * Called on:
 * - Seed phrase backup confirmation
 * - Recovery from an existing phrase
 * - Extension reset
 * - Automatically by timeout (5 minutes)
 */
function clearTempSeedPhrase(): void {
  if (tempSeedPhraseTimeoutId) {
    clearTimeout(tempSeedPhraseTimeoutId);
    tempSeedPhraseTimeoutId = null;
  }
  
  // Clear the value from memory
  if (tempSeedPhrase) {
    tempSeedPhrase = null;
  }
}

// ============================================================================
// Reset
// ============================================================================

/**
 * Performs a full extension reset.
 * 
 * @returns {success: boolean} — always true on a successful reset
 * 
 * @remarks
 * **Removes:**
 * - Temporary seed phrase from memory
 * - Encrypted master key
 * - Device key
 * - Information about all sites
 * - Extension settings
 * - Session cache and nonces
 *
 */
async function handleReset(): Promise<{ success: boolean }> {
  log.warn('Resetting extension');
  
  // Clear all sensitive data
  clearTempSeedPhrase();
  
  // Use secure reset
  await secureReset();
  await resetStorage();
  
  return { success: true };
}
