/**
 * Cryptographic module
 *
 * Implements:
 * - Seed phrase generation (BIP-39)
 * - Master Key derivation (PBKDF2-SHA512)
 * - Site Keys derivation (HKDF-SHA256)
 * - Ed25519 signatures
 * - AES-256-GCM encryption
 */

import * as ed from '@noble/ed25519';
import { generateMnemonic, validateMnemonic, mnemonicToSeed } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import type { Challenge, EncryptedData, KeyPair } from './types';
import { createLogger } from './logger';

const log = createLogger('CRYPTO');

// ============================================================================
// Constants
// ============================================================================

/**
 * Cryptographic operation parameters.
 */
const PBKDF2_ITERATIONS = 210_000;
/** Salt for master key derivation */
const MASTER_KEY_SALT = 'seedkey-auth-master-v1';
/** Context for HKDF site key derivation */
const SITE_KEY_INFO = 'seedkey-site-key-v1';
/** PBKDF2 iterations for AES encryption */
const AES_PBKDF2_ITERATIONS = 210_000;

// ============================================================================
// BIP-39 Mnemonic
// ============================================================================

/**
 * Generates a new 12-word seed phrase (128 bits of entropy).
 * 
 * @returns A string with 12 words separated by spaces
 * 
 * @remarks
 * Uses the BIP-39 standard with the English wordlist.
 * 
 * @example
 * const phrase = generateSeedPhrase();
 * // "abandon ability able about above absent absorb abstract absurd abuse access accident"
 */
export function generateSeedPhrase(): string {
  log.debug('Generating 12-word seed phrase');
  const phrase = generateMnemonic(wordlist, 128);
  log.debug('Seed phrase generated', { wordCount: phrase.split(' ').length });
  return phrase;
}

/**
 * Checks whether a BIP-39 seed phrase is valid.
 * 
 * @param seedPhrase - Seed phrase string to validate
 * @returns true if the phrase is valid (12 words from the BIP-39 wordlist with a correct checksum)
 * 
 * @remarks
 * Checks:
 * - Word count
 * - All words exist in the BIP-39 wordlist
 * - Checksum correctness
 */
export function isValidSeedPhrase(seedPhrase: string): boolean {
  const wordCount = seedPhrase.trim().split(/\s+/).length;
  log.debug('Validating seed phrase', { wordCount });
  const isValid = validateMnemonic(seedPhrase, wordlist);
  log.debug(isValid ? 'Seed phrase valid' : 'Seed phrase invalid');
  return isValid;
}

// ============================================================================
// Key Derivation
// ============================================================================

/**
 * Derives the Master Key from a seed phrase via PBKDF2-SHA512.
 * 
 * @param seedPhrase - BIP-39 seed phrase
 * @returns 256-bit master key as Uint8Array
 * 
 * @remarks
 * **Parameters:**
 * - Algorithm: PBKDF2-SHA512
 * - Iterations: 210,000
 * - Salt: fixed string "seedkey-auth-master-v1"
 * - Output: 256 bits
 *
 */
export async function deriveMasterKey(seedPhrase: string): Promise<Uint8Array> {
  log.debug('Deriving master key from seed phrase');
  const startTime = performance.now();
  const encoder = new TextEncoder();
  const normalizedSeed = seedPhrase.normalize('NFKD');

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(normalizedSeed),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const masterKeyBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(MASTER_KEY_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-512',
    },
    keyMaterial,
    256
  );

  const duration = (performance.now() - startTime).toFixed(2);
  log.debug(`Master key derived in ${duration}ms`);

  return new Uint8Array(masterKeyBits);
}

/**
 * Derives a unique Ed25519 keypair for a domain.
 * 
 * @param masterKey - 256-bit master key
 * @param domain - Website domain (will be normalized)
 * @returns Keypair {privateKey, publicKey}
 * 
 * @remarks
 * **Algorithm:**
 * 1. Normalizes the domain
 * 2. Hashes the domain with SHA-256 for use as salt
 * 3. Derives a 256-bit seed via HKDF-SHA256
 * 4. Generates an Ed25519 keypair from the seed
 * 
 * **Notes:**
 * - Each domain gets a unique keypair
 * - Compromise of one site's key does not affect others
 * - Accounts on different sites cannot be linked
 */
export async function deriveSiteKey(
  masterKey: Uint8Array,
  domain: string
): Promise<KeyPair> {
  log.debug('Deriving site key', { domain });
  const startTime = performance.now();
  const encoder = new TextEncoder();
  const normalizedDomain = normalizeDomain(domain);

  // Hash the domain for use as salt
  const domainHash = await sha256(encoder.encode(normalizedDomain));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    masterKey,
    'HKDF',
    false,
    ['deriveBits']
  );

  const siteKeyBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: domainHash,
      info: encoder.encode(SITE_KEY_INFO),
    },
    keyMaterial,
    256
  );

  const seed = new Uint8Array(siteKeyBits);
  const privateKey = seed;
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  const duration = (performance.now() - startTime).toFixed(2);
  log.debug(`Site key derived in ${duration}ms`, {
    publicKeyPrefix: uint8ArrayToBase64(publicKey).substring(0, 20) + '...',
  });

  return { privateKey, publicKey };
}

/**
 * Normalizes a domain.
 * 
 * @param domain - Domain or URL to normalize
 * @returns Normalized domain in lowercase without www
 *
 * @example
 * normalizeDomain("https://WWW.Example.COM:8080/path") // "example.com"
 * normalizeDomain("example.com") // "example.com"
 */
export function normalizeDomain(domain: string): string {
  try {
    const url = new URL(domain.includes('://') ? domain : `https://${domain}`);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return domain.toLowerCase().replace(/^www\./, '');
  }
}

// ============================================================================
// Ed25519 Signatures
// ============================================================================

/**
 * Signs a challenge object using Ed25519.
 * 
 * @param challenge - Challenge object from the backend
 * @param privateKey - Ed25519 private key (32 bytes)
 * @returns Base64-encoded signature (64 bytes)
 * 
 * @remarks
 * The challenge is canonicalized before signing (keys are sorted)
 * for consistency between the client and server.
 */
export async function signChallenge(
  challenge: Challenge,
  privateKey: Uint8Array
): Promise<string> {
  log.debug('Signing challenge', { action: challenge.action, domain: challenge.domain });

  const canonicalChallenge = canonicalizeChallenge(challenge);
  const messageBytes = new TextEncoder().encode(canonicalChallenge);
  const signature = await ed.signAsync(messageBytes, privateKey);

  log.debug('Challenge signed');
  return uint8ArrayToBase64(signature);
}

/**
 * Signs an arbitrary text message using Ed25519.
 * 
 * @param message - Text message to sign
 * @param privateKey - Ed25519 private key (32 bytes)
 * @returns Base64-encoded signature (64 bytes)
 * 
 * @remarks
 * Used to test custom scenarios.
 */
export async function signMessage(
  message: string,
  privateKey: Uint8Array
): Promise<string> {
  log.debug('Signing message', { length: message.length });

  const messageBytes = new TextEncoder().encode(message);
  const signature = await ed.signAsync(messageBytes, privateKey);

  log.debug('Message signed');
  return uint8ArrayToBase64(signature);
}

/**
 * Creates a canonical JSON representation of a challenge.
 * 
 * @param challenge - Challenge object
 * @returns JSON string with sorted keys
 * 
 * @remarks
 * Sorts keys alphabetically to produce a deterministic representation,
 * which is critical for correct signature verification.
 */
export function canonicalizeChallenge(challenge: Challenge): string {
  const sortedKeys = ['action', 'domain', 'expiresAt', 'nonce', 'timestamp'] as const;
  const canonical: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    canonical[key] = challenge[key];
  }

  return JSON.stringify(canonical);
}

// ============================================================================
// AES-256-GCM Encryption
// ============================================================================

/**
 * Encrypts data using AES-256-GCM.
 * 
 * @param data - Data to encrypt
 * @param password - Password used to derive the encryption key
 * @returns EncryptedData with iv, salt, and encrypted data in base64
 * 
 * @remarks
 * **Algorithm:**
 * 1. Generates a random salt (16 bytes)
 * 2. Generates a random IV (12 bytes)
 * 3. Derives an AES-256 key from the password via PBKDF2-SHA256
 * 4. Encrypts the data using AES-256-GCM
 *
 */
export async function encrypt(
  data: Uint8Array,
  password: string
): Promise<EncryptedData> {
  log.debug('Encrypting data', { length: data.length });
  const startTime = performance.now();
  const encoder = new TextEncoder();

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: AES_PBKDF2_ITERATIONS, 
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    data
  );

  const duration = (performance.now() - startTime).toFixed(2);
  log.debug(`Data encrypted in ${duration}ms`);

  return {
    iv: uint8ArrayToBase64(iv),
    data: uint8ArrayToBase64(new Uint8Array(encryptedData)),
    salt: uint8ArrayToBase64(salt),
  };
}

/**
 * Decrypts data encrypted by the encrypt function.
 * 
 * @param encrypted - EncryptedData object with iv, salt, and data
 * @param password - Password used to derive the decryption key
 * @returns Decrypted data as Uint8Array
 * 
 * @throws DOMException if the password is wrong or the data is corrupted
 * 
 * @remarks
 * GCM mode validates data integrity.
 */
export async function decrypt(
  encrypted: EncryptedData,
  password: string
): Promise<Uint8Array> {
  log.debug('Decrypting data');
  const startTime = performance.now();
  const encoder = new TextEncoder();

  const salt = base64ToUint8Array(encrypted.salt);
  const iv = base64ToUint8Array(encrypted.iv);
  const data = base64ToUint8Array(encrypted.data);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const decryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: AES_PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decryptedData = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    decryptionKey,
    data
  );

  const duration = (performance.now() - startTime).toFixed(2);
  log.debug(`Data decrypted in ${duration}ms`);

  return new Uint8Array(decryptedData);
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Computes a SHA-256 hash of the data.
 * @internal
 */
async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

/**
 * Converts a Uint8Array to a base64 string.
 * 
 * @param bytes - Byte array
 * @returns Base64-encoded string
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts a base64 string to a Uint8Array.
 * 
 * @param base64 - Base64-encoded string
 * @returns Byte array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates a cryptographically strong unique ID
 */
export function generateId(prefix = 'req'): string {
  const timestamp = Date.now().toString(36);
  // Cryptographically strong randomness
  const randomBytes = crypto.getRandomValues(new Uint8Array(8));
  const random = Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${timestamp}_${random}`;
}
