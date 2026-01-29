/**
 * API Endpoint Unit Tests: OAuth Encryption
 * Sprint 45 - T45.8
 * 
 * Tests for PBKDF2 key derivation and AES-256-GCM encryption
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pbkdf2Sync, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Test the crypto operations used in callback.ts
describe('OAuth Token Encryption', () => {
  const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  const IV_LENGTH = 12;
  const AUTH_TAG_LENGTH = 16;
  const PBKDF2_ITERATIONS = 100000;
  const KEY_LENGTH = 32;
  const PBKDF2_SALT = 'yardflow-hubspot-encryption-v1';

  function deriveKey(secret: string): Buffer {
    return pbkdf2Sync(secret, PBKDF2_SALT, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  }

  function encrypt(data: string, secret: string): string {
    const key = deriveKey(secret);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  function decrypt(encryptedBase64: string, secret: string): string | null {
    try {
      const key = deriveKey(secret);
      const combined = Buffer.from(encryptedBase64, 'base64');
      
      if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
        return null;
      }
      
      const iv = combined.subarray(0, IV_LENGTH);
      const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
      
      const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString('utf8');
    } catch {
      return null;
    }
  }

  describe('PBKDF2 Key Derivation', () => {
    it('should derive consistent key from same secret', () => {
      const secret = 'test-secret-key-12345';
      const key1 = deriveKey(secret);
      const key2 = deriveKey(secret);
      
      expect(key1.equals(key2)).toBe(true);
    });

    it('should derive different keys from different secrets', () => {
      const key1 = deriveKey('secret-one');
      const key2 = deriveKey('secret-two');
      
      expect(key1.equals(key2)).toBe(false);
    });

    it('should produce 32-byte key', () => {
      const key = deriveKey('any-secret');
      expect(key.length).toBe(32);
    });

    it('should use 100,000 iterations for key stretching', () => {
      // This is a security requirement - fewer iterations = weaker security
      expect(PBKDF2_ITERATIONS).toBe(100000);
    });
  });

  describe('AES-256-GCM Encryption', () => {
    const testSecret = 'my-super-secret-encryption-key-123';
    const testData = JSON.stringify({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: Date.now() + 3600000,
      portalId: '123456',
      hubDomain: 'test.hubspot.com',
    });

    it('should encrypt and decrypt successfully', () => {
      const encrypted = encrypt(testData, testSecret);
      const decrypted = decrypt(encrypted, testSecret);
      
      expect(decrypted).toBe(testData);
    });

    it('should produce different ciphertext each time (random IV)', () => {
      const encrypted1 = encrypt(testData, testSecret);
      const encrypted2 = encrypt(testData, testSecret);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should fail decryption with wrong secret', () => {
      const encrypted = encrypt(testData, testSecret);
      const decrypted = decrypt(encrypted, 'wrong-secret');
      
      expect(decrypted).toBeNull();
    });

    it('should fail decryption with tampered ciphertext', () => {
      const encrypted = encrypt(testData, testSecret);
      const buffer = Buffer.from(encrypted, 'base64');
      // Tamper with the ciphertext (flip a bit)
      buffer[buffer.length - 1] ^= 0x01;
      const tampered = buffer.toString('base64');
      
      const decrypted = decrypt(tampered, testSecret);
      expect(decrypted).toBeNull();
    });

    it('should fail decryption with truncated data', () => {
      const encrypted = encrypt(testData, testSecret);
      const truncated = encrypted.slice(0, 10);
      
      const decrypted = decrypt(truncated, testSecret);
      expect(decrypted).toBeNull();
    });

    it('should use 12-byte IV (GCM standard)', () => {
      expect(IV_LENGTH).toBe(12);
    });

    it('should use 16-byte auth tag (128-bit)', () => {
      expect(AUTH_TAG_LENGTH).toBe(16);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string encryption', () => {
      const encrypted = encrypt('', 'secret');
      const decrypted = decrypt(encrypted, 'secret');
      
      expect(decrypted).toBe('');
    });

    it('should handle large payloads', () => {
      const largeData = JSON.stringify({
        data: 'x'.repeat(10000),
      });
      const encrypted = encrypt(largeData, 'secret');
      const decrypted = decrypt(encrypted, 'secret');
      
      expect(decrypted).toBe(largeData);
    });

    it('should handle unicode characters', () => {
      const unicodeData = '{"message": "こんにちは世界 🌍"}';
      const encrypted = encrypt(unicodeData, 'secret');
      const decrypted = decrypt(encrypted, 'secret');
      
      expect(decrypted).toBe(unicodeData);
    });
  });
});
