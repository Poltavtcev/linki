import { test, expect, beforeAll } from 'vitest';
import { encryptSecret, decryptSecret, isEncrypted } from '../../lib/crypto';

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-32-chars-test-secret";
});

test('crypto utilities', () => {
  const plaintext = 'my-secret-key';
  
  // Test encryption
  const encrypted = encryptSecret(plaintext);
  expect(encrypted).toMatch(/^v1:/);
  expect(isEncrypted(encrypted)).toBe(true);
  
  // Test decryption
  const decrypted = decryptSecret(encrypted);
  expect(decrypted).toBe(plaintext);
  
  // Test backwards compatibility
  expect(decryptSecret(plaintext)).toBe(plaintext);
  expect(isEncrypted(plaintext)).toBe(false);
});
