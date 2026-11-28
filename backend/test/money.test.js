'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { currencyDecimals, toMinorUnits } = require('../src/money');

test('PKR and USD use two decimal places', () => {
  assert.equal(currencyDecimals('PKR'), 2);
  assert.equal(toMinorUnits('125.50', 'PKR'), '12550');
  assert.equal(toMinorUnits('3', 'USD'), '300');
});

test('zero and three-decimal currencies use correct precision', () => {
  assert.equal(toMinorUnits('125', 'JPY'), '125');
  assert.equal(toMinorUnits('1.234', 'KWD'), '1234');
});

test('rejects invalid, negative, zero, excessive precision and unsafe amounts', () => {
  assert.equal(toMinorUnits('-1.00', 'USD'), null);
  assert.equal(toMinorUnits('0', 'USD'), null);
  assert.equal(toMinorUnits('1.001', 'USD'), null);
  assert.equal(toMinorUnits('01.00', 'USD'), null);
  assert.equal(toMinorUnits('90000000000000.01', 'USD'), null);
  assert.equal(toMinorUnits(12.5, 'USD'), null);
});
