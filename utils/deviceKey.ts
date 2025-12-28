/**
 * Device Key Management
 * 
 * Generates and stores a unique device key for encrypting the Master Key.
 * In the future, it can be extended to support biometrics.
 */

import { createLogger } from './logger';

const log = createLogger('DEVICE_KEY');

/** Key in browser.storage.local for the device key */
const DEVICE_KEY_STORAGE_KEY = 'seedkey:deviceKey';
/** Device key length in bytes (256-bit) */
const DEVICE_KEY_LENGTH = 32;

// ============================================================================
// Device Key Generation & Storage
// ============================================================================

/**
 * Generates a new cryptographically strong device key.
 * 
 * @returns Base64-encoded device key (256-bit)
 * 
 * @remarks
 * Used on the first extension initialization.
 * The device key is unique for each extension installation
 * and is used to encrypt the master key.
 * 
 * **Note:** This is a legacy version.
 * For new installations, use secureStorage.generateSecureDeviceKey().
 */
export async function generateDeviceKey(): Promise<string> {
  log.debug('Generating new device key');
  
  // Generate a cryptographically strong random key
  const keyBytes = crypto.getRandomValues(new Uint8Array(DEVICE_KEY_LENGTH));
  
  // Convert to base64 for storage
  const deviceKey = btoa(String.fromCharCode(...keyBytes));
  
  // Save to storage
  await browser.storage.local.set({ [DEVICE_KEY_STORAGE_KEY]: deviceKey });
  
  log.debug('Device key generated and saved');
  return deviceKey;
}

/**
 * Gets the device key from storage or generates a new one.
 * 
 * @returns Base64-encoded device key
 * 
 * @remarks
 * On the first call, generates a new device key.
 * Subsequent calls return the saved key.
 */
export async function getDeviceKey(): Promise<string> {
  const result = await browser.storage.local.get(DEVICE_KEY_STORAGE_KEY);
  const existingKey = result[DEVICE_KEY_STORAGE_KEY] as string | undefined;
  
  if (existingKey) {
    log.debug('Using existing device key');
    return existingKey;
  }
  
  // If the key is missing, generate a new one
  return generateDeviceKey();
}

/**
 * Checks whether the device key exists in storage.
 * 
 * @returns true if the device key exists
 */
export async function hasDeviceKey(): Promise<boolean> {
  const result = await browser.storage.local.get(DEVICE_KEY_STORAGE_KEY);
  return !!result[DEVICE_KEY_STORAGE_KEY];
}

/**
 * Removes the device key from storage.
 * 
 * @remarks
 * Used on a full extension reset.
 * After removal, the previous master key cannot be decrypted.
 */
export async function clearDeviceKey(): Promise<void> {
  log.debug('Clearing device key');
  await browser.storage.local.remove(DEVICE_KEY_STORAGE_KEY);
}
