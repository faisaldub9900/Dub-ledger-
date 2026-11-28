'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.MFA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
const { encryptSecret, decryptSecret } = require('../src/mfa-crypto');

test('MFA secret can be encrypted and decrypted', () => {
  const secret = 'JBSWY3DPEHPK3PXP';
  const encrypted = encryptSecret(secret);
  assert.notEqual(encrypted, secret);
  assert.equal(decryptSecret(encrypted), secret);
});

test('encrypted MFA secret uses a fresh nonce', () => {
  const secret = 'JBSWY3DPEHPK3PXP';
  assert.notEqual(encryptSecret(secret), encryptSecret(secret));
});

test('tampered MFA ciphertext is rejected', () => {
  const encrypted = encryptSecret('JBSWY3DPEHPK3PXP');
  const parts = encrypted.split('.');
  parts[2] = Buffer.from('tampered').toString('base64url');
  assert.throws(() => decryptSecret(parts.join('.')));
});
