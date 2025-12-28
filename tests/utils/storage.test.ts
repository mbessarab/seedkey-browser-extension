/**
 * Tests for the Storage API
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { storageMock } from '../setup';
import {
  encryptedMasterKey,
  isInitialized,
  settings,
  getStorageData,
  updateSettings,
  resetStorage,
} from '@/utils/storage';
import type { EncryptedData, StorageSettings } from '@/utils/types';

// ============================================================================
// Storage Keys Constants (for validating key correctness)
// ============================================================================

const STORAGE_KEYS = {
  encryptedMasterKey: 'seedkey:encryptedMasterKey',
  initialized: 'seedkey:initialized',
  settings: 'seedkey:settings',
};

// ============================================================================
// encryptedMasterKey
// ============================================================================

describe('encryptedMasterKey', () => {
  it('should return null by default', async () => {
    const value = await encryptedMasterKey.getValue();
    expect(value).toBeNull();
  });

  it('should store and retrieve an encrypted key', async () => {
    const testData: EncryptedData = {
      iv: 'test-iv-base64',
      data: 'test-encrypted-data-base64',
      salt: 'test-salt-base64',
    };

    await encryptedMasterKey.setValue(testData);
    const retrieved = await encryptedMasterKey.getValue();

    expect(retrieved).toEqual(testData);
  });

  it('should remove a value', async () => {
    const testData: EncryptedData = {
      iv: 'iv',
      data: 'data',
      salt: 'salt',
    };

    await encryptedMasterKey.setValue(testData);
    await encryptedMasterKey.removeValue();

    const value = await encryptedMasterKey.getValue();
    expect(value).toBeNull();
  });

  it('should allow setting null', async () => {
    const testData: EncryptedData = {
      iv: 'iv',
      data: 'data',
      salt: 'salt',
    };

    await encryptedMasterKey.setValue(testData);
    await encryptedMasterKey.setValue(null);

    const value = await encryptedMasterKey.getValue();
    expect(value).toBeNull();
  });
});

// ============================================================================
// isInitialized
// ============================================================================

describe('isInitialized', () => {
  it('should return false by default', async () => {
    const value = await isInitialized.getValue();
    expect(value).toBe(false);
  });

  it('should store true', async () => {
    await isInitialized.setValue(true);
    const value = await isInitialized.getValue();
    expect(value).toBe(true);
  });

  it('should store false', async () => {
    await isInitialized.setValue(true);
    await isInitialized.setValue(false);
    const value = await isInitialized.getValue();
    expect(value).toBe(false);
  });
});

// ============================================================================
// settings
// ============================================================================

describe('settings', () => {
  it('should return default settings', async () => {
    const value = await settings.getValue();
    expect(value).toEqual({
      autoPrompt: true,
      theme: 'system',
    });
  });

  it('should store settings', async () => {
    const testSettings: StorageSettings = {
      autoPrompt: false,
      theme: 'dark',
    };

    await settings.setValue(testSettings);
    const retrieved = await settings.getValue();

    expect(retrieved).toEqual(testSettings);
  });

  it('should support all theme variants', async () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];

    for (const theme of themes) {
      await settings.setValue({ autoPrompt: true, theme });
      const retrieved = await settings.getValue();
      expect(retrieved.theme).toBe(theme);
    }
  });
});

// ============================================================================
// getStorageData
// ============================================================================

describe('getStorageData', () => {
  it('should return all storage data', async () => {
    // Set test data
    await isInitialized.setValue(true);
    await settings.setValue({ autoPrompt: false, theme: 'dark' });

    const data = await getStorageData();

    expect(data).toHaveProperty('encryptedMasterKey');
    expect(data).toHaveProperty('initialized');
    expect(data).toHaveProperty('settings');
    expect(data.initialized).toBe(true);
    expect(data.settings.theme).toBe('dark');
  });

  it('should return default values for empty storage', async () => {
    const data = await getStorageData();

    expect(data.encryptedMasterKey).toBeNull();
    expect(data.initialized).toBe(false);
    expect(data.settings).toEqual({ autoPrompt: true, theme: 'system' });
  });
});

// ============================================================================
// updateSettings
// ============================================================================

describe('updateSettings', () => {
  it('should update individual settings', async () => {
    await updateSettings({ theme: 'dark' });

    const currentSettings = await settings.getValue();

    expect(currentSettings.theme).toBe('dark');
    expect(currentSettings.autoPrompt).toBe(true); // default value preserved
  });

  it('should update multiple settings at once', async () => {
    await updateSettings({ theme: 'light', autoPrompt: false });

    const currentSettings = await settings.getValue();

    expect(currentSettings.theme).toBe('light');
    expect(currentSettings.autoPrompt).toBe(false);
  });

  it('should preserve existing settings on partial updates', async () => {
    await settings.setValue({ autoPrompt: false, theme: 'dark' });
    await updateSettings({ theme: 'light' });

    const currentSettings = await settings.getValue();

    expect(currentSettings.autoPrompt).toBe(false); // preserved
    expect(currentSettings.theme).toBe('light'); // updated
  });
});

// ============================================================================
// resetStorage
// ============================================================================

describe('resetStorage', () => {
  it('should remove all extension data', async () => {
    // Set data
    await isInitialized.setValue(true);
    await encryptedMasterKey.setValue({ iv: 'iv', data: 'data', salt: 'salt' });
    await settings.setValue({ autoPrompt: false, theme: 'dark' });

    // Reset
    await resetStorage();

    // Verify reset
    const data = await getStorageData();
    expect(data.initialized).toBe(false);
    expect(data.encryptedMasterKey).toBeNull();
    expect(data.settings).toEqual({ autoPrompt: true, theme: 'system' });
  });

  it('should not throw for empty storage', async () => {
    await expect(resetStorage()).resolves.not.toThrow();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Storage Integration', () => {
  it('should correctly support the full usage lifecycle', async () => {
    // 1. Initialization
    await isInitialized.setValue(true);
    await encryptedMasterKey.setValue({
      iv: 'test-iv',
      data: 'encrypted-master-key',
      salt: 'test-salt',
    });

    // 2. State verification
    const data = await getStorageData();
    expect(data.initialized).toBe(true);
    expect(data.encryptedMasterKey).not.toBeNull();

    // 3. Reset
    await resetStorage();
    const finalData = await getStorageData();
    expect(finalData.initialized).toBe(false);
    expect(finalData.encryptedMasterKey).toBeNull();
  });

  it('should isolate data between different tests', async () => {
    // This test verifies that beforeEach in setup.ts works
    const data = await getStorageData();

    expect(data.initialized).toBe(false);
    expect(data.encryptedMasterKey).toBeNull();
  });
});
