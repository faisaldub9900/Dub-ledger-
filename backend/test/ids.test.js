'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isUuid } = require('../src/ids');

test('accepts canonical UUID values', () => {
  assert.equal(isUuid('550e8400-e29b-41d4-a716-446655440000'), true);
});

test('rejects malformed and non-string identifiers', () => {
  for (const value of [null, undefined, 7, '', 'not-a-uuid',
    '550e8400-e29b-41d4-a716-44665544000g',
    '550e8400-e29b-11d4-a716-446655440000']) {
    assert.equal(isUuid(value), false);
  }
});
