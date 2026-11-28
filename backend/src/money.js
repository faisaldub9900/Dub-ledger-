'use strict';

function currencyDecimals(currency) {
  if (currency === 'JPY') return 0;
  if (currency === 'KWD' || currency === 'BHD') return 3;
  return 2;
}

function toMinorUnits(amount, currency) {
  if (typeof amount !== 'string' || !/^(0|[1-9]\d*)(\.\d+)?$/.test(amount)) return null;
  const digits = currencyDecimals(currency);
  const parts = amount.split('.');
  if ((parts[1] || '').length > digits) return null;
  const whole = BigInt(parts[0]);
  const fraction = BigInt(((parts[1] || '').padEnd(digits, '0')) || '0');
  const value = whole * (10n ** BigInt(digits)) + fraction;
  if (value <= 0n || value > 9000000000000000n) return null;
  return value.toString();
}

module.exports = { currencyDecimals, toMinorUnits };
