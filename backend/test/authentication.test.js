'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('session tokens are high entropy and hash to fixed-size digests', () => {
  const token = crypto.randomBytes(32).toString('base64url');
  const digest = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
  assert.ok(token.length >= 40);
  assert.match(digest, /^[a-f0-9]{64}$/);
});

test('session token digest does not equal the bearer token', () => {
  const token = crypto.randomBytes(32).toString('base64url');
  const digest = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
  assert.notEqual(digest, token);
});
