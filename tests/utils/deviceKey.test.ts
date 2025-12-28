/**
 * Tests for Device Key Management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { storageMock } from '../setup';
import {
  generateDeviceKey,
  getDeviceKey,
  hasDeviceKey,
  clearDeviceKey,
} from '@/utils/deviceKey';

const DEVICE_KEY_STORAGE_KEY = 'seedkey:deviceKey';

// ============================================================================
// generateDeviceKey
// ============================================================================

describe('generateDeviceKey', () => {
  it('should generate a key in base64 format', async () => {
    const key = await generateDeviceKey();
    
    expect(typeof key).toBe('string');
    // Verify that this is valid base64
    expect(() => atob(key)).not.toThrow();
  });

  it('should generate a 256-bit key (32 bytes)', async () => {
    const key = await generateDeviceKey();
    const decoded = atob(key);
    
    expect(decoded.length).toBe(32);
  });

  it('should store the key in storage', async () => {
    await generateDeviceKey();
    
    const stored = storageMock._getStore()[DEVICE_KEY_STORAGE_KEY];
    expect(stored).toBeDefined();
    expect(typeof stored).toBe('string');
  });

  it('should generate unique keys', async () => {
    // Reset storage before each generation
    const keys = new Set<string>();
    
    for (let i = 0; i < 10; i++) {
      storageMock._reset();
      const key = await generateDeviceKey();
      keys.add(key);
    }
    
    expect(keys.size).toBe(10);
  });

  it('should overwrite an existing key', async () => {
    const key1 = await generateDeviceKey();
    storageMock._reset();
    const key2 = await generateDeviceKey();
    
    // Keys should differ (randomly generated)
    expect(key1).not.toBe(key2);
  });
});

// ============================================================================
// getDeviceKey
// ============================================================================

describe('getDeviceKey', () => {
  it('should return an existing key', async () => {
    const generatedKey = await generateDeviceKey();
    const retrievedKey = await getDeviceKey();
    
    expect(retrievedKey).toBe(generatedKey);
  });

  it('should generate a new key if missing', async () => {
    // Storage is empty (beforeEach resets it)
    const key = await getDeviceKey();
    
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });

  it('should return the same key across repeated calls', async () => {
    const key1 = await getDeviceKey();
    const key2 = await getDeviceKey();
    const key3 = await getDeviceKey();
    
    expect(key1).toBe(key2);
    expect(key2).toBe(key3);
  });

  it('should persist an automatically generated key', async () => {
    const key = await getDeviceKey();
    
    // Verify that the key is saved in storage
    const hasKey = await hasDeviceKey();
    expect(hasKey).toBe(true);
    
    // And that the next call returns the same key
    const key2 = await getDeviceKey();
    expect(key).toBe(key2);
  });
});

// ============================================================================
// hasDeviceKey
// ============================================================================

describe('hasDeviceKey', () => {
  it('should return false if the key is missing', async () => {
    const hasKey = await hasDeviceKey();
    expect(hasKey).toBe(false);
  });

  it('should return true after generating a key', async () => {
    await generateDeviceKey();
    
    const hasKey = await hasDeviceKey();
    expect(hasKey).toBe(true);
  });

  it('should return true after getDeviceKey', async () => {
    await getDeviceKey(); // Should auto-generate
    
    const hasKey = await hasDeviceKey();
    expect(hasKey).toBe(true);
  });

  it('should return false after clearDeviceKey', async () => {
    await generateDeviceKey();
    await clearDeviceKey();
    
    const hasKey = await hasDeviceKey();
    expect(hasKey).toBe(false);
  });
});

// ============================================================================
// clearDeviceKey
// ============================================================================

describe('clearDeviceKey', () => {
  it('should remove an existing key', async () => {
    await generateDeviceKey();
    
    await clearDeviceKey();
    
    const hasKey = await hasDeviceKey();
    expect(hasKey).toBe(false);
  });

  it('should not throw if the key is missing', async () => {
    await expect(clearDeviceKey()).resolves.not.toThrow();
  });

  it('should allow generating a new key after clearing', async () => {
    const key1 = await generateDeviceKey();
    await clearDeviceKey();
    const key2 = await generateDeviceKey();
    
    // New key should be different
    expect(key1).not.toBe(key2);
    
    // And it should be saved
    const hasKey = await hasDeviceKey();
    expect(hasKey).toBe(true);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('DeviceKey Integration', () => {
  it('should support the full lifecycle: generate → get → clear → get (new)', async () => {
    // Generate
    const key1 = await generateDeviceKey();
    expect(await hasDeviceKey()).toBe(true);
    
    // Get (should return the same key)
    const key2 = await getDeviceKey();
    expect(key2).toBe(key1);
    
    // Clear
    await clearDeviceKey();
    expect(await hasDeviceKey()).toBe(false);
    
    // Get again (should generate a new one)
    const key3 = await getDeviceKey();
    expect(key3).not.toBe(key1);
    expect(await hasDeviceKey()).toBe(true);
  });

  it('the key should be cryptographically strong', async () => {
    const key = await generateDeviceKey();
    const decoded = atob(key);
    
    // Simple entropy check: not all bytes should be identical
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
    
    const uniqueBytes = new Set(bytes);
    // In 32 random bytes, there should be many unique values
    expect(uniqueBytes.size).toBeGreaterThan(10);
  });

  it('should isolate data between tests', async () => {
    // Verify that the key is absent at the start of the test
    const hasKey = await hasDeviceKey();
    expect(hasKey).toBe(false);
  });
});
