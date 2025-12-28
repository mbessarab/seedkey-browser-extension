/**
 * Tests for types and Zod schemas
 */

import { describe, it, expect } from 'vitest';
import { ChallengeSchema, ErrorCodes } from '@/utils/types';
import type { Challenge, SeedKeyError, ExtensionState } from '@/utils/types';

// ============================================================================
// ChallengeSchema
// ============================================================================

describe('ChallengeSchema', () => {
  const validChallenge: Challenge = {
    nonce: 'test-nonce-12345',
    timestamp: 1234567890000,
    domain: 'example.com',
    action: 'authenticate',
    expiresAt: 1234567899000,
  };

  describe('valid challenges', () => {
    it('should accept a valid challenge for authenticate', () => {
      const result = ChallengeSchema.safeParse(validChallenge);
      expect(result.success).toBe(true);
    });

    it('should accept a valid challenge for register', () => {
      const challenge = { ...validChallenge, action: 'register' };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(true);
    });

    it('should accept a challenge with minimal valid values', () => {
      const minimalChallenge: Challenge = {
        nonce: 'n',
        timestamp: 1,
        domain: 'd',
        action: 'authenticate',
        expiresAt: 1,
      };
      const result = ChallengeSchema.safeParse(minimalChallenge);
      expect(result.success).toBe(true);
    });

    it('should accept a challenge with large numbers', () => {
      const challenge: Challenge = {
        nonce: 'test',
        timestamp: Number.MAX_SAFE_INTEGER,
        domain: 'example.com',
        action: 'register',
        expiresAt: Number.MAX_SAFE_INTEGER,
      };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(true);
    });

    it('should accept a long nonce', () => {
      const challenge = { ...validChallenge, nonce: 'a'.repeat(1000) };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(true);
    });

    it('should accept a complex domain', () => {
      const challenge = { ...validChallenge, domain: 'sub.domain.example.co.uk' };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid nonce', () => {
    it('should reject an empty nonce', () => {
      const challenge = { ...validChallenge, nonce: '' };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(false);
    });

    it('should reject a missing nonce', () => {
      const { nonce, ...challengeWithoutNonce } = validChallenge;
      const result = ChallengeSchema.safeParse(challengeWithoutNonce);
      expect(result.success).toBe(false);
    });

    it('should reject a nonce that is not a string', () => {
      const challenge = { ...validChallenge, nonce: 12345 };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(false);
    });

    it('should reject a null nonce', () => {
      const challenge = { ...validChallenge, nonce: null };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(false);
    });
  });

  describe('invalid timestamp', () => {
    it('should reject a negative timestamp', () => {
      const challenge = { ...validChallenge, timestamp: -1 };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(false);
    });

    it('should reject a zero timestamp', () => {
      const challenge = { ...validChallenge, timestamp: 0 };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(false);
    });

    it('should reject a non-integer timestamp', () => {
      const challenge = { ...validChallenge, timestamp: 123.456 };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(false);
    });

    it('should reject a timestamp provided as a string', () => {
      const challenge = { ...validChallenge, timestamp: '1234567890000' };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(false);
    });

    it('should reject a missing timestamp', () => {
      const { timestamp, ...challengeWithoutTimestamp } = validChallenge;
      const result = ChallengeSchema.safeParse(challengeWithoutTimestamp);
      expect(result.success).toBe(false);
    });
  });

  describe('invalid domain', () => {
    it('should reject an empty domain', () => {
      const challenge = { ...validChallenge, domain: '' };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(false);
    });

    it('should reject a missing domain', () => {
      const { domain, ...challengeWithoutDomain } = validChallenge;
      const result = ChallengeSchema.safeParse(challengeWithoutDomain);
      expect(result.success).toBe(false);
    });

    it('should reject a domain that is not a string', () => {
      const challenge = { ...validChallenge, domain: 123 };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(false);
    });
  });

  describe('invalid action', () => {
    it('should reject an unknown action', () => {
      const challenge = { ...validChallenge, action: 'unknown' };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(false);
    });

    it('should reject an action with wrong casing', () => {
      const challenge = { ...validChallenge, action: 'Authenticate' };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(false);
    });

    it('should reject an action that is not a string', () => {
      const challenge = { ...validChallenge, action: 1 };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(false);
    });

    it('should reject a missing action', () => {
      const { action, ...challengeWithoutAction } = validChallenge;
      const result = ChallengeSchema.safeParse(challengeWithoutAction);
      expect(result.success).toBe(false);
    });

    it('should reject an empty action', () => {
      const challenge = { ...validChallenge, action: '' };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(false);
    });
  });

  describe('invalid expiresAt', () => {
    it('should reject a negative expiresAt', () => {
      const challenge = { ...validChallenge, expiresAt: -1 };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(false);
    });

    it('should reject a zero expiresAt', () => {
      const challenge = { ...validChallenge, expiresAt: 0 };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(false);
    });

    it('should reject a non-integer expiresAt', () => {
      const challenge = { ...validChallenge, expiresAt: 123.456 };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(false);
    });

    it('should reject a missing expiresAt', () => {
      const { expiresAt, ...challengeWithoutExpiresAt } = validChallenge;
      const result = ChallengeSchema.safeParse(challengeWithoutExpiresAt);
      expect(result.success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should reject null', () => {
      const result = ChallengeSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('should reject undefined', () => {
      const result = ChallengeSchema.safeParse(undefined);
      expect(result.success).toBe(false);
    });

    it('should reject an empty object', () => {
      const result = ChallengeSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject an array', () => {
      const result = ChallengeSchema.safeParse([]);
      expect(result.success).toBe(false);
    });

    it('should reject a string', () => {
      const result = ChallengeSchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });

    it('should reject a number', () => {
      const result = ChallengeSchema.safeParse(12345);
      expect(result.success).toBe(false);
    });

    it('should ignore additional fields', () => {
      const challenge = { ...validChallenge, extraField: 'ignored' };
      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(true);
      // Extra field should not be present in the result
      if (result.success) {
        expect(result.data).not.toHaveProperty('extraField');
      }
    });
  });

  describe('type inference', () => {
    it('should infer types correctly from a successful parse', () => {
      const result = ChallengeSchema.safeParse(validChallenge);
      
      if (result.success) {
        // TypeScript should know all fields
        const { nonce, timestamp, domain, action, expiresAt } = result.data;
        
        expect(typeof nonce).toBe('string');
        expect(typeof timestamp).toBe('number');
        expect(typeof domain).toBe('string');
        expect(['register', 'authenticate']).toContain(action);
        expect(typeof expiresAt).toBe('number');
      }
    });

    it('should return errors with detailed information', () => {
      const invalidChallenge = { ...validChallenge, nonce: '' };
      const result = ChallengeSchema.safeParse(invalidChallenge);
      
      if (!result.success) {
        expect(result.error.errors.length).toBeGreaterThan(0);
        expect(result.error.errors[0].path).toContain('nonce');
      }
    });
  });
});

// ============================================================================
// ErrorCodes
// ============================================================================

describe('ErrorCodes', () => {
  it('should contain all expected error codes', () => {
    expect(ErrorCodes.EXTENSION_NOT_FOUND).toBe('EXTENSION_NOT_FOUND');
    expect(ErrorCodes.NOT_INITIALIZED).toBe('NOT_INITIALIZED');
    expect(ErrorCodes.USER_REJECTED).toBe('USER_REJECTED');
    expect(ErrorCodes.INVALID_CHALLENGE).toBe('INVALID_CHALLENGE');
    expect(ErrorCodes.CHALLENGE_EXPIRED).toBe('CHALLENGE_EXPIRED');
    expect(ErrorCodes.DOMAIN_MISMATCH).toBe('DOMAIN_MISMATCH');
    expect(ErrorCodes.INVALID_SEED).toBe('INVALID_SEED');
    expect(ErrorCodes.ENCRYPTION_ERROR).toBe('ENCRYPTION_ERROR');
    expect(ErrorCodes.DECRYPTION_ERROR).toBe('DECRYPTION_ERROR');
    expect(ErrorCodes.USER_EXISTS).toBe('USER_EXISTS');
    expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(ErrorCodes.UNKNOWN_ACTION).toBe('UNKNOWN_ACTION');
  });

  it('all codes should be unique', () => {
    const codes = Object.values(ErrorCodes);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it('codes should be in UPPER_SNAKE_CASE', () => {
    const codes = Object.values(ErrorCodes);
    codes.forEach((code) => {
      expect(code).toMatch(/^[A-Z][A-Z_]*[A-Z]$/);
    });
  });

  it('keys and values should match', () => {
    Object.entries(ErrorCodes).forEach(([key, value]) => {
      expect(key).toBe(value);
    });
  });
});

// ============================================================================
// Type Structure Tests
// ============================================================================

describe('Type Structures', () => {
  describe('SeedKeyError', () => {
    it('should have the correct structure', () => {
      const error: SeedKeyError = {
        code: ErrorCodes.INVALID_SEED,
        message: 'Invalid seed phrase',
      };

      expect(error.code).toBe('INVALID_SEED');
      expect(error.message).toBe('Invalid seed phrase');
    });

    it('should accept any code from ErrorCodes', () => {
      Object.values(ErrorCodes).forEach((code) => {
        const error: SeedKeyError = {
          code,
          message: `Error: ${code}`,
        };
        expect(error.code).toBe(code);
      });
    });
  });

  describe('ExtensionState', () => {
    it('should have the correct structure', () => {
      const state: ExtensionState = {
        initialized: true,
        settings: {
          autoPrompt: true,
          theme: 'system',
        },
      };

      expect(state.initialized).toBe(true);
      expect(state.settings.autoPrompt).toBe(true);
      expect(state.settings.theme).toBe('system');
    });

    it('should support the optional seedPhrase field', () => {
      const stateWithSeed: ExtensionState = {
        initialized: false,
        seedPhrase: 'test seed phrase words',
        settings: {
          autoPrompt: true,
          theme: 'dark',
        },
      };

      expect(stateWithSeed.seedPhrase).toBe('test seed phrase words');

      const stateWithoutSeed: ExtensionState = {
        initialized: true,
        settings: {
          autoPrompt: false,
          theme: 'light',
        },
      };

      expect(stateWithoutSeed.seedPhrase).toBeUndefined();
    });

  });
});

// ============================================================================
// Security Tests
// ============================================================================

describe('Security validation', () => {
  describe('Challenge validation security', () => {
    it('should protect against prototype pollution', () => {
      const maliciousChallenge = {
        nonce: 'test',
        timestamp: 1234567890,
        domain: 'example.com',
        action: 'authenticate',
        expiresAt: 9999999999,
        constructor: { prototype: { admin: true } },
      };

      const result = ChallengeSchema.safeParse(maliciousChallenge);
      
      if (result.success) {
        // Verify that the malicious constructor field did not get into the result
        expect(result.data).not.toHaveProperty('constructor');
        // And that "admin" is definitely not present
        expect((result.data as Record<string, unknown>).admin).toBeUndefined();
        // The result should contain only expected fields
        expect(Object.keys(result.data).sort()).toEqual(['action', 'domain', 'expiresAt', 'nonce', 'timestamp']);
      }
    });

    it('should protect against XSS in string fields', () => {
      // Zod does not escape HTML, but it checks types
      const xssChallenge = {
        nonce: '<script>alert("xss")</script>',
        timestamp: 1234567890,
        domain: '<img src=x onerror=alert(1)>',
        action: 'authenticate',
        expiresAt: 9999999999,
      };

      const result = ChallengeSchema.safeParse(xssChallenge);
      
      // The schema accepts any strings; XSS protection must be handled at render time
      expect(result.success).toBe(true);
    });

    it('should reject very large numbers', () => {
      const challenge = {
        nonce: 'test',
        timestamp: Infinity,
        domain: 'example.com',
        action: 'authenticate',
        expiresAt: 9999999999,
      };

      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(false);
    });

    it('should reject NaN', () => {
      const challenge = {
        nonce: 'test',
        timestamp: NaN,
        domain: 'example.com',
        action: 'authenticate',
        expiresAt: 9999999999,
      };

      const result = ChallengeSchema.safeParse(challenge);
      expect(result.success).toBe(false);
    });
  });
});
