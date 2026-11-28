'use strict';

const crypto = require('node:crypto');

function encryptionKey() {
  const encoded = process.env.MFA_ENCRYPTION_KEY || '';
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) {
    const error = new Error('MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
    error.code = 'MFA_KEY_NOT_CONFIGURED';
    throw error;
  }
  return key;
}

function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map(part => part.toString('base64url')).join('.');
}

function decryptSecret(value) {
  const parts = String(value || '').split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted MFA secret');
  const [iv, tag, ciphertext] = parts.map(part => Buffer.from(part, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { encryptSecret, decryptSecret };
