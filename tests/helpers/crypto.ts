/**
 * Test crypto utilities
 * 
 * Contains functions used only for testing.
 * In production, signature verification is performed on the backend.
 */

import * as ed from '@noble/ed25519';
import { base64ToUint8Array } from '@/utils/crypto';

/**
 * Verifies an Ed25519 message signature.
 * 
 * @param signature - Base64-encoded signature
 * @param message - Original message
 * @param publicKey - Ed25519 public key (32 bytes)
 * @returns true if the signature is valid, false otherwise
 * 
 * @remarks
 * Used ONLY for testing.
 * In production, verification is performed on the backend.
 */
export async function verifySignature(
  signature: string,
  message: string,
  publicKey: Uint8Array
): Promise<boolean> {
  try {
    const signatureBytes = base64ToUint8Array(signature);
    const messageBytes = new TextEncoder().encode(message);
    return await ed.verifyAsync(signatureBytes, messageBytes, publicKey);
  } catch {
    return false;
  }
}

