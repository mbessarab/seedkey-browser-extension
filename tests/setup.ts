/**
 * Vitest Setup File
 * 
 * Test environment setup and global mocks.
 */

import { vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// ============================================================================
// Browser Storage Mock
// ============================================================================

const createStorageMock = () => {
  let store: Record<string, unknown> = {};
  
  return {
    get: vi.fn(async (keys?: string | string[] | Record<string, unknown> | null) => {
      if (keys === null || keys === undefined) {
        return { ...store };
      }
      
      if (typeof keys === 'string') {
        return { [keys]: store[keys] };
      }
      
      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          result[key] = store[key];
        }
        return result;
      }
      
      // Object with defaults
      const result: Record<string, unknown> = {};
      for (const [key, defaultValue] of Object.entries(keys)) {
        result[key] = store[key] ?? defaultValue;
      }
      return result;
    }),
    
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) {
        store[key] = value;
      }
    }),
    
    remove: vi.fn(async (keys: string | string[]) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      for (const key of keysArray) {
        delete store[key];
      }
    }),
    
    clear: vi.fn(async () => {
      store = {};
    }),
    
    // Helper for tests
    _getStore: () => store,
    _setStore: (newStore: Record<string, unknown>) => {
      store = newStore;
    },
    _reset: () => {
      store = {};
    },
  };
};

// ============================================================================
// Browser Runtime Mock
// ============================================================================

const createRuntimeMock = () => ({
  id: 'test-extension-id',
  getURL: vi.fn((path: string) => `chrome-extension://test-extension-id${path}`),
  onInstalled: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(() => false),
  },
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(() => false),
  },
  sendMessage: vi.fn(),
  getManifest: vi.fn(() => ({
    name: 'SeedKey Auth Extension',
    version: '0.0.1',
    manifest_version: 3,
  })),
});

// ============================================================================
// Global Browser Mock
// ============================================================================

const storageMock = createStorageMock();

const browserMock = {
  storage: {
    local: storageMock,
    sync: createStorageMock(),
    session: createStorageMock(),
  },
  runtime: createRuntimeMock(),
};

// Install global browser mock
(globalThis as unknown as { browser: typeof browserMock }).browser = browserMock;

// Also for Chrome API compatibility
(globalThis as unknown as { chrome: typeof browserMock }).chrome = browserMock;

// ============================================================================
// Web Crypto Mock (for Node.js environment)
// ============================================================================

// Node.js 20+ provides Web Crypto API on the global object
if (typeof globalThis.crypto === 'undefined') {
  const { webcrypto } = await import('crypto');
  (globalThis as unknown as { crypto: typeof webcrypto }).crypto = webcrypto as unknown as Crypto;
}

// ============================================================================
// Performance Mock
// ============================================================================

if (typeof globalThis.performance === 'undefined') {
  (globalThis as unknown as { performance: { now: () => number } }).performance = {
    now: () => Date.now(),
  };
}

// ============================================================================
// Import Meta Mock
// ============================================================================

// @ts-expect-error - mock import.meta.env
globalThis.import = {
  meta: {
    env: {
      DEV: true,
      PROD: false,
      MODE: 'test',
    },
  },
};

// ============================================================================
// Test Lifecycle Hooks
// ============================================================================

beforeEach(() => {
  // Reset storage between tests
  storageMock._reset();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// Export helpers for tests
// ============================================================================

export { browserMock, storageMock };
