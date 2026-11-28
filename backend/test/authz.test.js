'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { requireAuthenticated, requireOwner } = require('../src/authz');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

test('authentication middleware rejects missing user', () => {
  const res = responseRecorder();
  let nextCalled = false;
  requireAuthenticated({}, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('authentication middleware rejects inactive user', () => {
  const res = responseRecorder();
  requireAuthenticated({ user: { id: 'u1', is_active: false } }, res, () => {});
  assert.equal(res.statusCode, 401);
});

test('authentication middleware accepts active user', () => {
  const res = responseRecorder();
  let nextCalled = false;
  requireAuthenticated({ user: { id: 'u1', is_active: true } }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('owner middleware rejects ordinary user', () => {
  const res = responseRecorder();
  let nextCalled = false;
  requireOwner({ user: { id: 'u2', role: 'user' } }, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('owner middleware accepts owner role', () => {
  const res = responseRecorder();
  let nextCalled = false;
  requireOwner({ user: { id: 'owner1', role: 'owner' } }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
