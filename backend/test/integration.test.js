'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { authenticator } = require('otplib');
const crypto = require('node:crypto');

const enabled = process.env.RUN_DB_INTEGRATION === 'true';
const baseUrl = `http://127.0.0.1:${process.env.PORT || '8099'}`;
const ownerEmail = process.env.OWNER_EMAIL || 'owner@example.test';
const ownerPassword = process.env.OWNER_PASSWORD || 'Test-Only-Owner-Password-2026!';

async function waitForReady(child) {
  const deadline = Date.now() + 30000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/ready`);
      if (response.ok) return;
      lastError = new Error(`API readiness returned ${response.status}`);
    } catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw lastError || new Error('API did not become ready');
}

async function api(path, { method = 'GET', token, body, key } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  if (key) headers['Idempotency-Key'] = key;
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
  const raw = await response.text();
  return { status: response.status, body: raw ? JSON.parse(raw) : null };
}

test('PostgreSQL-backed Owner, MFA, wallet and approval flow', { skip: !enabled, timeout: 90000 }, async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL must be set by the integration workflow');
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, HOST: '127.0.0.1', PORT: process.env.PORT || '8099', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  child.stdout.on('data', chunk => { logs += chunk.toString(); });
  child.stderr.on('data', chunk => { logs += chunk.toString(); });

  try {
    await waitForReady(child);
    const health = await api('/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'ok');

    const login = await api('/auth/login', {
      method: 'POST', body: { email: ownerEmail, password: ownerPassword }
    });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    assert.equal(login.body.user.role, 'owner');
    const firstToken = login.body.token;

    const setup = await api('/mfa/setup', { method: 'POST', token: firstToken, body: {} });
    assert.equal(setup.status, 200, JSON.stringify(setup.body));
    assert.ok(setup.body.secret);
    const code = authenticator.generate(setup.body.secret);
    const verified = await api('/mfa/verify', { method: 'POST', token: firstToken, body: { code } });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    assert.equal(verified.body.mfa_enabled, true);

    const revoked = await api('/auth/me', { token: firstToken });
    assert.equal(revoked.status, 401, 'MFA enrollment must revoke existing sessions');

    const mfaLogin = await api('/auth/login', {
      method: 'POST', body: {
        email: ownerEmail, password: ownerPassword, mfa_code: authenticator.generate(setup.body.secret)
      }
    });
    assert.equal(mfaLogin.status, 200, JSON.stringify(mfaLogin.body));
    const ownerToken = mfaLogin.body.token;

    const me = await api('/auth/me', { token: ownerToken });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.role, 'owner');

    const createdUser = await api('/owner/users', {
      method: 'POST', token: ownerToken,
      body: { email: 'member@example.test', display_name: 'Test Member', temporary_password: 'Test-Member-Password-2026!' }
    });
    assert.equal(createdUser.status, 201, JSON.stringify(createdUser.body));

    const memberLogin = await api('/auth/login', {
      method: 'POST', body: { email: 'member@example.test', password: 'Test-Member-Password-2026!' }
    });
    assert.equal(memberLogin.status, 200);
    const forbidden = await api('/owner/users', { token: memberLogin.body.token });
    assert.equal(forbidden.status, 403, 'ordinary user must not access Owner administration');

    const walletA = await api('/ledger/wallets', {
      method: 'POST', token: ownerToken,
      body: { name: 'Integration Cash', currency: 'PKR', account_kind: 'cash' }
    });
    assert.equal(walletA.status, 201, JSON.stringify(walletA.body));
    const walletB = await api('/ledger/wallets', {
      method: 'POST', token: ownerToken,
      body: { name: 'Integration Bank', currency: 'PKR', account_kind: 'bank' }
    });
    assert.equal(walletB.status, 201, JSON.stringify(walletB.body));

    const deposit = await api('/ledger/transactions', {
      method: 'POST', token: ownerToken, key: crypto.randomUUID(),
      body: { transaction_type: 'deposit', destination_wallet_id: walletA.body.wallet.id, amount: '1000.00', currency: 'PKR', description: 'Integration deposit' }
    });
    assert.equal(deposit.status, 201, JSON.stringify(deposit.body));
    assert.equal(deposit.body.transaction.status, 'pending');

    const pending = await api('/approvals/pending', { token: ownerToken });
    assert.equal(pending.status, 200);
    assert.ok(pending.body.pending.some(item => item.id === deposit.body.transaction.id));

    const approvedDeposit = await api(`/approvals/${deposit.body.transaction.id}/approve`, { method: 'POST', token: ownerToken, body: {} });
    assert.equal(approvedDeposit.status, 200, JSON.stringify(approvedDeposit.body));

    const transfer = await api('/ledger/transactions', {
      method: 'POST', token: ownerToken, key: crypto.randomUUID(),
      body: { transaction_type: 'transfer', source_wallet_id: walletA.body.wallet.id, destination_wallet_id: walletB.body.wallet.id, amount: '250.00', currency: 'PKR', description: 'Integration transfer' }
    });
    assert.equal(transfer.status, 201, JSON.stringify(transfer.body));
    const approvedTransfer = await api(`/approvals/${transfer.body.transaction.id}/approve`, { method: 'POST', token: ownerToken, body: {} });
    assert.equal(approvedTransfer.status, 200, JSON.stringify(approvedTransfer.body));

    const withdrawal = await api('/ledger/transactions', {
      method: 'POST', token: ownerToken, key: crypto.randomUUID(),
      body: { transaction_type: 'withdrawal', source_wallet_id: walletB.body.wallet.id, amount: '50.00', currency: 'PKR', description: 'Integration withdrawal' }
    });
    assert.equal(withdrawal.status, 201, JSON.stringify(withdrawal.body));
    const approvedWithdrawal = await api(`/approvals/${withdrawal.body.transaction.id}/approve`, { method: 'POST', token: ownerToken, body: {} });
    assert.equal(approvedWithdrawal.status, 200, JSON.stringify(approvedWithdrawal.body));

    const wallets = await api('/ledger/wallets', { token: ownerToken });
    const balanceA = wallets.body.wallets.find(item => item.id === walletA.body.wallet.id);
    const balanceB = wallets.body.wallets.find(item => item.id === walletB.body.wallet.id);
    assert.equal(balanceA.balance_minor, '75000');
    assert.equal(balanceB.balance_minor, '20000');

    const insufficient = await api('/ledger/transactions', {
      method: 'POST', token: ownerToken, key: crypto.randomUUID(),
      body: { transaction_type: 'withdrawal', source_wallet_id: walletB.body.wallet.id, amount: '99999.00', currency: 'PKR', description: 'Must be rejected at approval' }
    });
    assert.equal(insufficient.status, 201);
    const rejectedAtApproval = await api(`/approvals/${insufficient.body.transaction.id}/approve`, { method: 'POST', token: ownerToken, body: {} });
    assert.equal(rejectedAtApproval.status, 409);
    assert.match(rejectedAtApproval.body.error, /Insufficient/);

    const logout = await api('/auth/logout', { method: 'POST', token: ownerToken });
    assert.equal(logout.status, 204);
    const afterLogout = await api('/auth/me', { token: ownerToken });
    assert.equal(afterLogout.status, 401);
  } catch (error) {
    error.message += `\nAPI logs:\n${logs}`;
    throw error;
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve => {
      if (child.exitCode !== null) return resolve();
      const timer = setTimeout(resolve, 5000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
    if (child.exitCode === null) child.kill('SIGKILL');
  }
});
