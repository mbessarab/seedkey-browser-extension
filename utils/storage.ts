/**
 * Type-Safe Storage API
 *
 * Uses browser.storage.local for persistent storage.
 */

import type { EncryptedData, StorageSettings } from './types';

// ============================================================================
// Storage Keys
// ============================================================================

/** Keys for browser.storage.local */
const STORAGE_KEYS = {
  encryptedMasterKey: 'seedkey:encryptedMasterKey',
  initialized: 'seedkey:initialized',
  settings: 'seedkey:settings',
  version: 'seedkey:version',
  createdAt: 'seedkey:createdAt',
} as const;

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_SETTINGS: StorageSettings = {
  autoPrompt: true,
  theme: 'system',
};

// ============================================================================
// Storage Item Helpers
// ============================================================================

/**
 * Gets a value from browser.storage.local.
 * @internal
 * @param key - Storage key
 * @param defaultValue - Default value if the key is not found
 */
async function getItem<T>(key: string, defaultValue: T): Promise<T> {
  const result = await browser.storage.local.get(key);
  return (result[key] as T) ?? defaultValue;
}

/**
 * Saves a value to browser.storage.local.
 * @internal
 */
async function setItem<T>(key: string, value: T): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

/**
 * Removes a value from browser.storage.local.
 * @internal
 */
async function removeItem(key: string): Promise<void> {
  await browser.storage.local.remove(key);
}

// ============================================================================
// Typed Storage Accessors
// ============================================================================

/**
 * Typed accessor for the encrypted master key.
 * Stores EncryptedData with iv, salt, and encrypted data.
 */
export const encryptedMasterKey = {
  getValue: () => getItem<EncryptedData | null>(STORAGE_KEYS.encryptedMasterKey, null),
  setValue: (value: EncryptedData | null) => setItem(STORAGE_KEYS.encryptedMasterKey, value),
  removeValue: () => removeItem(STORAGE_KEYS.encryptedMasterKey),
};

/**
 * Typed accessor for the initialization flag.
 * true if the extension is fully initialized.
 */
export const isInitialized = {
  getValue: () => getItem<boolean>(STORAGE_KEYS.initialized, false),
  setValue: (value: boolean) => setItem(STORAGE_KEYS.initialized, value),
};

/**
 * Typed accessor for extension settings.
 * Stores StorageSettings (autoPrompt, theme).
 */
export const settings = {
  getValue: () => getItem<StorageSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS),
  setValue: (value: StorageSettings) => setItem(STORAGE_KEYS.settings, value),
};

/**
 * Typed accessor for identity creation time.
 * Stores the creation timestamp to determine seed phrase availability.
 */
export const createdAt = {
  getValue: () => getItem<number | null>(STORAGE_KEYS.createdAt, null),
  setValue: (value: number | null) => setItem(STORAGE_KEYS.createdAt, value),
};

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * Get all storage data
 */
export async function getStorageData() {
  const [encryptedKey, initialized, settingsData] = await Promise.all([
    encryptedMasterKey.getValue(),
    isInitialized.getValue(),
    settings.getValue(),
  ]);

  return {
    encryptedMasterKey: encryptedKey,
    initialized,
    settings: settingsData,
  };
}

/**
 * Update settings
 */
export async function updateSettings(newSettings: Partial<StorageSettings>): Promise<void> {
  const current = await settings.getValue();
  await settings.setValue({ ...current, ...newSettings });
}

/**
 * Full extension reset
 */
export async function resetStorage(): Promise<void> {
  await browser.storage.local.remove([
    STORAGE_KEYS.encryptedMasterKey,
    STORAGE_KEYS.initialized,
    STORAGE_KEYS.settings,
    STORAGE_KEYS.createdAt,
    'seedkey:deviceKey', // Also remove the device key
  ]);
}
