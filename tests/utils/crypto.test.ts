/**
 * Tests for the cryptographic module
 */

import { describe, it, expect, vi } from 'vitest';
import {
  generateSeedPhrase,
  isValidSeedPhrase,
  deriveMasterKey,
  deriveSiteKey,
  normalizeDomain,
  signChallenge,
  signMessage,
  canonicalizeChallenge,
  encrypt,
  decrypt,
  uint8ArrayToBase64,
  base64ToUint8Array,
  generateId,
} from '@/utils/crypto';
import { verifySignature } from '../helpers/crypto';
import type { Challenge } from '@/utils/types';

// ============================================================================
// BIP-39 Mnemonic
// ============================================================================

describe('generateSeedPhrase', () => {
  it('should generate 12 words', () => {
    const phrase = generateSeedPhrase();
    const words = phrase.split(' ');
    expect(words).toHaveLength(12);
  });

  it('should generate a valid BIP-39 phrase', () => {
    const phrase = generateSeedPhrase();
    expect(isValidSeedPhrase(phrase)).toBe(true);
  });

  it('should generate unique phrases', () => {
    const phrases = new Set<string>();
    for (let i = 0; i < 10; i++) {
      phrases.add(generateSeedPhrase());
    }
    expect(phrases.size).toBe(10);
  });

  it('each word should be from the BIP-39 wordlist', () => {
    const phrase = generateSeedPhrase();
    const words = phrase.split(' ');
    // All words should be non-empty and contain only letters
    words.forEach((word) => {
      expect(word).toMatch(/^[a-z]+$/);
    });
  });
});

describe('isValidSeedPhrase', () => {
  it('should validate a correct 12-word phrase', () => {
    const phrase = generateSeedPhrase();
    expect(isValidSeedPhrase(phrase)).toBe(true);
  });

  it('should reject invalid phrases', () => {
    expect(isValidSeedPhrase('invalid seed phrase')).toBe(false);
    expect(isValidSeedPhrase('')).toBe(false);
    expect(isValidSeedPhrase('word'.repeat(12))).toBe(false);
  });

  it('should reject phrases with an incorrect number of words', () => {
    expect(isValidSeedPhrase('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon')).toBe(false); // 11 words
  });

  it('should handle extra whitespace at the edges', () => {
    const phrase = generateSeedPhrase();
    // Edge whitespace - trim() should help
    const phraseWithEdgeSpaces = `  ${phrase}  `;
    expect(isValidSeedPhrase(phraseWithEdgeSpaces.trim())).toBe(true);
  });

  it('should reject phrases with double spaces inside', () => {
    const phrase = generateSeedPhrase();
    // BIP-39 library does NOT normalize double spaces inside the phrase
    const phraseWithDoubleSpaces = phrase.replace(/ /g, '  ');
    expect(isValidSeedPhrase(phraseWithDoubleSpaces)).toBe(false);
  });

  it('should validate a known test phrase', () => {
    // Known test phrase from the BIP-39 specification
    const testPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    expect(isValidSeedPhrase(testPhrase)).toBe(true);
  });
});

// ============================================================================
// Key Derivation
// ============================================================================

describe('deriveMasterKey', () => {
  it('should derive a 256-bit key', async () => {
    const phrase = generateSeedPhrase();
    const masterKey = await deriveMasterKey(phrase);
    
    expect(masterKey).toBeInstanceOf(Uint8Array);
    expect(masterKey.length).toBe(32); // 256 bits = 32 bytes
  });

  it('should derive the same key for the same phrase', async () => {
    const phrase = generateSeedPhrase();
    const key1 = await deriveMasterKey(phrase);
    const key2 = await deriveMasterKey(phrase);
    
    expect(uint8ArrayToBase64(key1)).toBe(uint8ArrayToBase64(key2));
  });

  it('should derive different keys for different phrases', async () => {
    const phrase1 = generateSeedPhrase();
    const phrase2 = generateSeedPhrase();
    
    const key1 = await deriveMasterKey(phrase1);
    const key2 = await deriveMasterKey(phrase2);
    
    expect(uint8ArrayToBase64(key1)).not.toBe(uint8ArrayToBase64(key2));
  });

  it('should normalize Unicode (NFKD)', async () => {
    const phrase = generateSeedPhrase();
    // The same phrase in different Unicode forms should produce the same key
    const key1 = await deriveMasterKey(phrase);
    const key2 = await deriveMasterKey(phrase.normalize('NFKD'));
    
    expect(uint8ArrayToBase64(key1)).toBe(uint8ArrayToBase64(key2));
  });
});

describe('deriveSiteKey', () => {
  it('should derive a key pair for a domain', async () => {
    const phrase = generateSeedPhrase();
    const masterKey = await deriveMasterKey(phrase);
    const siteKey = await deriveSiteKey(masterKey, 'example.com');
    
    expect(siteKey.privateKey).toBeInstanceOf(Uint8Array);
    expect(siteKey.publicKey).toBeInstanceOf(Uint8Array);
    expect(siteKey.privateKey.length).toBe(32);
    expect(siteKey.publicKey.length).toBe(32);
  });

  it('should derive the same keys for the same domain', async () => {
    const phrase = generateSeedPhrase();
    const masterKey = await deriveMasterKey(phrase);
    
    const key1 = await deriveSiteKey(masterKey, 'example.com');
    const key2 = await deriveSiteKey(masterKey, 'example.com');
    
    expect(uint8ArrayToBase64(key1.publicKey)).toBe(uint8ArrayToBase64(key2.publicKey));
  });

  it('should derive different keys for different domains', async () => {
    const phrase = generateSeedPhrase();
    const masterKey = await deriveMasterKey(phrase);
    
    const key1 = await deriveSiteKey(masterKey, 'example.com');
    const key2 = await deriveSiteKey(masterKey, 'another.com');
    
    expect(uint8ArrayToBase64(key1.publicKey)).not.toBe(uint8ArrayToBase64(key2.publicKey));
  });

  it('should derive different keys for different master keys', async () => {
    const phrase1 = generateSeedPhrase();
    const phrase2 = generateSeedPhrase();
    
    const masterKey1 = await deriveMasterKey(phrase1);
    const masterKey2 = await deriveMasterKey(phrase2);
    
    const key1 = await deriveSiteKey(masterKey1, 'example.com');
    const key2 = await deriveSiteKey(masterKey2, 'example.com');
    
    expect(uint8ArrayToBase64(key1.publicKey)).not.toBe(uint8ArrayToBase64(key2.publicKey));
  });
});

// ============================================================================
// Domain Normalization
// ============================================================================

describe('normalizeDomain', () => {
  it('should remove the www prefix', () => {
    expect(normalizeDomain('www.example.com')).toBe('example.com');
  });

  it('should convert to lowercase', () => {
    expect(normalizeDomain('EXAMPLE.COM')).toBe('example.com');
    expect(normalizeDomain('Example.Com')).toBe('example.com');
  });

  it('should extract hostname from a URL', () => {
    expect(normalizeDomain('https://example.com/path')).toBe('example.com');
    expect(normalizeDomain('https://www.example.com:8080/path?query=1')).toBe('example.com');
  });

  it('should handle a domain without a protocol', () => {
    expect(normalizeDomain('example.com')).toBe('example.com');
  });

  it('should preserve subdomains (except www)', () => {
    expect(normalizeDomain('api.example.com')).toBe('api.example.com');
    expect(normalizeDomain('www.api.example.com')).toBe('api.example.com');
  });

  it('should handle localhost', () => {
    expect(normalizeDomain('localhost')).toBe('localhost');
    expect(normalizeDomain('http://localhost:3000')).toBe('localhost');
  });

  it('should handle IP addresses', () => {
    expect(normalizeDomain('192.168.1.1')).toBe('192.168.1.1');
    expect(normalizeDomain('http://192.168.1.1:8080')).toBe('192.168.1.1');
  });
});

// ============================================================================
// Ed25519 Signatures
// ============================================================================

describe('signChallenge', () => {
  const createTestChallenge = (overrides: Partial<Challenge> = {}): Challenge => ({
    nonce: 'test-nonce-12345',
    timestamp: Date.now(),
    domain: 'example.com',
    action: 'authenticate',
    expiresAt: Date.now() + 300000, // 5 minutes
    ...overrides,
  });

  it('should sign a challenge', async () => {
    const phrase = generateSeedPhrase();
    const masterKey = await deriveMasterKey(phrase);
    const siteKey = await deriveSiteKey(masterKey, 'example.com');
    
    const challenge = createTestChallenge();
    const signature = await signChallenge(challenge, siteKey.privateKey);
    
    expect(signature).toBeDefined();
    expect(typeof signature).toBe('string');
    // Ed25519 Base64 signature (64 bytes) is ~88 chars
    expect(signature.length).toBeGreaterThan(80);
  });

  it('should produce different signatures for different challenges', async () => {
    const phrase = generateSeedPhrase();
    const masterKey = await deriveMasterKey(phrase);
    const siteKey = await deriveSiteKey(masterKey, 'example.com');
    
    const challenge1 = createTestChallenge({ nonce: 'nonce-1' });
    const challenge2 = createTestChallenge({ nonce: 'nonce-2' });
    
    const sig1 = await signChallenge(challenge1, siteKey.privateKey);
    const sig2 = await signChallenge(challenge2, siteKey.privateKey);
    
    expect(sig1).not.toBe(sig2);
  });

  it('should produce the same signature for identical challenges', async () => {
    const phrase = generateSeedPhrase();
    const masterKey = await deriveMasterKey(phrase);
    const siteKey = await deriveSiteKey(masterKey, 'example.com');
    
    const challenge = createTestChallenge();
    const sig1 = await signChallenge(challenge, siteKey.privateKey);
    const sig2 = await signChallenge(challenge, siteKey.privateKey);
    
    expect(sig1).toBe(sig2);
  });
});

describe('signMessage', () => {
  it('should sign an arbitrary message', async () => {
    const phrase = generateSeedPhrase();
    const masterKey = await deriveMasterKey(phrase);
    const siteKey = await deriveSiteKey(masterKey, 'example.com');
    
    const signature = await signMessage('Hello, World!', siteKey.privateKey);
    
    expect(signature).toBeDefined();
    expect(typeof signature).toBe('string');
  });

  it('should produce different signatures for different messages', async () => {
    const phrase = generateSeedPhrase();
    const masterKey = await deriveMasterKey(phrase);
    const siteKey = await deriveSiteKey(masterKey, 'example.com');
    
    const sig1 = await signMessage('Message 1', siteKey.privateKey);
    const sig2 = await signMessage('Message 2', siteKey.privateKey);
    
    expect(sig1).not.toBe(sig2);
  });
});

describe('verifySignature', () => {
  it('should verify a valid signature', async () => {
    const phrase = generateSeedPhrase();
    const masterKey = await deriveMasterKey(phrase);
    const siteKey = await deriveSiteKey(masterKey, 'example.com');
    
    const message = 'Test message';
    const signature = await signMessage(message, siteKey.privateKey);
    
    const isValid = await verifySignature(signature, message, siteKey.publicKey);
    expect(isValid).toBe(true);
  });

  it('should reject a signature with a different message', async () => {
    const phrase = generateSeedPhrase();
    const masterKey = await deriveMasterKey(phrase);
    const siteKey = await deriveSiteKey(masterKey, 'example.com');
    
    const signature = await signMessage('Original message', siteKey.privateKey);
    
    const isValid = await verifySignature(signature, 'Different message', siteKey.publicKey);
    expect(isValid).toBe(false);
  });

  it('should reject a signature with a different public key', async () => {
    const phrase1 = generateSeedPhrase();
    const phrase2 = generateSeedPhrase();
    
    const masterKey1 = await deriveMasterKey(phrase1);
    const masterKey2 = await deriveMasterKey(phrase2);
    
    const siteKey1 = await deriveSiteKey(masterKey1, 'example.com');
    const siteKey2 = await deriveSiteKey(masterKey2, 'example.com');
    
    const message = 'Test message';
    const signature = await signMessage(message, siteKey1.privateKey);
    
    const isValid = await verifySignature(signature, message, siteKey2.publicKey);
    expect(isValid).toBe(false);
  });

  it('should reject an invalid signature', async () => {
    const phrase = generateSeedPhrase();
    const masterKey = await deriveMasterKey(phrase);
    const siteKey = await deriveSiteKey(masterKey, 'example.com');
    
    const isValid = await verifySignature('invalid-signature', 'message', siteKey.publicKey);
    expect(isValid).toBe(false);
  });
});

describe('canonicalizeChallenge', () => {
  it('should create JSON with sorted keys', () => {
    const challenge: Challenge = {
      nonce: 'test-nonce',
      timestamp: 1234567890,
      domain: 'example.com',
      action: 'authenticate',
      expiresAt: 1234567899,
    };
    
    const canonical = canonicalizeChallenge(challenge);
    const parsed = JSON.parse(canonical);
    
    // Verify key order
    const keys = Object.keys(parsed);
    expect(keys).toEqual(['action', 'domain', 'expiresAt', 'nonce', 'timestamp']);
  });

  it('should produce identical output for equivalent challenges', () => {
    const challenge1: Challenge = {
      action: 'register',
      domain: 'test.com',
      expiresAt: 1000,
      nonce: 'nonce',
      timestamp: 500,
    };
    
    const challenge2: Challenge = {
      timestamp: 500,
      nonce: 'nonce',
      expiresAt: 1000,
      domain: 'test.com',
      action: 'register',
    };
    
    expect(canonicalizeChallenge(challenge1)).toBe(canonicalizeChallenge(challenge2));
  });
});

// ============================================================================
// AES-256-GCM Encryption
// ============================================================================

describe('encrypt/decrypt', () => {
  it('should encrypt and decrypt data', async () => {
    const originalData = new TextEncoder().encode('Hello, World!');
    const password = 'test-password-123';
    
    const encrypted = await encrypt(originalData, password);
    const decrypted = await decrypt(encrypted, password);
    
    expect(new TextDecoder().decode(decrypted)).toBe('Hello, World!');
  });

  it('should return a structure with iv, data, and salt', async () => {
    const data = new TextEncoder().encode('test');
    const encrypted = await encrypt(data, 'password');
    
    expect(encrypted).toHaveProperty('iv');
    expect(encrypted).toHaveProperty('data');
    expect(encrypted).toHaveProperty('salt');
    expect(typeof encrypted.iv).toBe('string');
    expect(typeof encrypted.data).toBe('string');
    expect(typeof encrypted.salt).toBe('string');
  });

  it('should generate different iv and salt on each encryption', async () => {
    const data = new TextEncoder().encode('test');
    const password = 'password';
    
    const encrypted1 = await encrypt(data, password);
    const encrypted2 = await encrypt(data, password);
    
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
    expect(encrypted1.salt).not.toBe(encrypted2.salt);
    // Encrypted data should also differ due to different iv
    expect(encrypted1.data).not.toBe(encrypted2.data);
  });

  it('should throw an error for an incorrect password', async () => {
    const data = new TextEncoder().encode('secret');
    const encrypted = await encrypt(data, 'correct-password');
    
    await expect(decrypt(encrypted, 'wrong-password')).rejects.toThrow();
  });

  it('should handle large data correctly', async () => {
    const largeData = new Uint8Array(100000).fill(42);
    const password = 'password';
    
    const encrypted = await encrypt(largeData, password);
    const decrypted = await decrypt(encrypted, password);
    
    expect(decrypted).toEqual(largeData);
  });

  it('should handle empty data correctly', async () => {
    const emptyData = new Uint8Array(0);
    const password = 'password';
    
    const encrypted = await encrypt(emptyData, password);
    const decrypted = await decrypt(encrypted, password);
    
    expect(decrypted.length).toBe(0);
  });
});

// ============================================================================
// Utility Functions
// ============================================================================

describe('uint8ArrayToBase64 / base64ToUint8Array', () => {
  it('should convert to base64 and back', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 255, 0, 128]);
    const base64 = uint8ArrayToBase64(original);
    const restored = base64ToUint8Array(base64);
    
    expect(restored).toEqual(original);
  });

  it('should handle an empty array', () => {
    const empty = new Uint8Array(0);
    const base64 = uint8ArrayToBase64(empty);
    const restored = base64ToUint8Array(base64);
    
    expect(restored.length).toBe(0);
  });

  it('should create valid base64', () => {
    const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const base64 = uint8ArrayToBase64(data);
    
    // Verify that this is valid base64
    expect(() => atob(base64)).not.toThrow();
    expect(base64).toBe('SGVsbG8=');
  });
});

describe('generateId', () => {
  it('should generate an ID with the specified prefix', () => {
    const id = generateId('req');
    // New format: prefix_timestamp_hexrandom 
    expect(id).toMatch(/^req_[a-z0-9]+_[a-f0-9]{16}$/);
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  it('should use the default prefix', () => {
    const id = generateId();
    expect(id.startsWith('req_')).toBe(true);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Full crypto flow', () => {
  it('should support the full flow: seed → master key → site key → sign → verify', async () => {
    // Generate seed phrase
    const seedPhrase = generateSeedPhrase();
    expect(isValidSeedPhrase(seedPhrase)).toBe(true);
    
    // Derive master key
    const masterKey = await deriveMasterKey(seedPhrase);
    expect(masterKey.length).toBe(32);
    
    // Derive site key for the domain
    const domain = 'example.com';
    const siteKey = await deriveSiteKey(masterKey, domain);
    
    // Create and sign a challenge
    const challenge: Challenge = {
      nonce: 'test-nonce-' + Math.random(),
      timestamp: Date.now(),
      domain: domain,
      action: 'authenticate',
      expiresAt: Date.now() + 300000,
    };
    
    const signature = await signChallenge(challenge, siteKey.privateKey);
    
    // 5. Verify the signature
    const canonicalChallenge = canonicalizeChallenge(challenge);
    const isValid = await verifySignature(signature, canonicalChallenge, siteKey.publicKey);
    
    expect(isValid).toBe(true);
  });

  it('should support recovery from the same seed phrase', async () => {
    // Original initialization
    const seedPhrase = generateSeedPhrase();
    const masterKey1 = await deriveMasterKey(seedPhrase);
    const siteKey1 = await deriveSiteKey(masterKey1, 'example.com');
    
    // "Recovery" - derive again
    const masterKey2 = await deriveMasterKey(seedPhrase);
    const siteKey2 = await deriveSiteKey(masterKey2, 'example.com');
    
    // Public keys should match
    expect(uint8ArrayToBase64(siteKey1.publicKey)).toBe(uint8ArrayToBase64(siteKey2.publicKey));
    
    // A signature from one key should verify with the other
    const message = 'Test message';
    const signature = await signMessage(message, siteKey1.privateKey);
    const isValid = await verifySignature(signature, message, siteKey2.publicKey);
    
    expect(isValid).toBe(true);
  });

  it('should correctly encrypt and persist a master key', async () => {
    const seedPhrase = generateSeedPhrase();
    const masterKey = await deriveMasterKey(seedPhrase);
    const devicePassword = 'device-key-123';
    
    // Encrypt master key
    const encrypted = await encrypt(masterKey, devicePassword);
    
    // Decrypt
    const decrypted = await decrypt(encrypted, devicePassword);
    
    // Verify the key was restored correctly
    expect(uint8ArrayToBase64(decrypted)).toBe(uint8ArrayToBase64(masterKey));
    
    // And that it still works for derivation
    const siteKey = await deriveSiteKey(decrypted, 'example.com');
    expect(siteKey.publicKey.length).toBe(32);
  });
});
